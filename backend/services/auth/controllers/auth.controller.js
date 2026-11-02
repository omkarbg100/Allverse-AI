import crypto from "crypto"
import { getAuth } from "firebase-admin/auth"
import { app, firebaseEnabled } from "../config/firebase.js"
import User from "../models/user.model.js"
import redis from "../../../shared/redis/redis.js"

const SESSION_TTL = 7 * 24 * 60 * 60
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const normalizeEmail = (email) => String(email || "").trim().toLowerCase()

const publicUser = (user) => {
    const data = user.toObject ? user.toObject() : { ...user }
    delete data.passwordHash
    return data
}

const hashPassword = (password) => {
    const salt = crypto.randomBytes(16).toString("hex")
    const hash = crypto.scryptSync(password, salt, 64).toString("hex")
    return `scrypt$${salt}$${hash}`
}

const verifyPassword = (password, storedHash) => {
    try {
        const [scheme, salt, hash] = String(storedHash).split("$")
        if (scheme !== "scrypt" || !salt || !hash) return false
        const derived = crypto.scryptSync(password, salt, 64)
        const expected = Buffer.from(hash, "hex")
        return derived.length === expected.length && crypto.timingSafeEqual(derived, expected)
    } catch {
        return false
    }
}

const createSession = async (user, res) => {
    const sessionId = crypto.randomUUID()
    const session = {
        userId: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        plan: user.plan,
        credits: user.credits,
        totalCredits: user.totalCredits,
        planExpiresAt: user.planExpiresAt
    }

    await redis.set(`user-session-${user._id}`, sessionId, "EX", SESSION_TTL)
    await redis.set(`session-${sessionId}`, JSON.stringify(session), "EX", SESSION_TTL)

    res.cookie("session", sessionId, {
        httpOnly: true,
        secure: false,
        sameSite: "strict",
        maxAge: SESSION_TTL * 1000
    })

    return res.status(200).json(publicUser(user))
}

export const register = async (req, res) => {
    try {
        const { name, email, password } = req.body || {}
        const normalizedEmail = normalizeEmail(email)
        const normalizedName = String(name || "").trim()

        if (normalizedName.length < 2 || normalizedName.length > 80) {
            return res.status(400).json({ message: "Please enter a valid name." })
        }
        if (!EMAIL_PATTERN.test(normalizedEmail)) {
            return res.status(400).json({ message: "Please enter a valid email address." })
        }
        if (typeof password !== "string" || password.length < 8 || password.length > 128) {
            return res.status(400).json({ message: "Password must be between 8 and 128 characters." })
        }

        const existingUser = await User.findOne({ email: normalizedEmail })
        if (existingUser) {
            return res.status(409).json({ message: "An account with this email already exists." })
        }

        const user = await User.create({
            firebaseUid: `local:${crypto.randomUUID()}`,
            name: normalizedName,
            email: normalizedEmail,
            avatar: "",
            passwordHash: hashPassword(password)
        })

        return await createSession(user, res)
    } catch (error) {
        if (error?.code === 11000) {
            return res.status(409).json({ message: "An account with this email already exists." })
        }
        return res.status(500).json({ message: `registration error ${error}` })
    }
}

export const login = async (req, res) => {
    try {
        const { token, email, password } = req.body || {}

        if (email || password) {
            if (!email || typeof password !== "string") {
                return res.status(400).json({ message: "Email and password are required." })
            }

            const user = await User.findOne({ email: normalizeEmail(email) }).select("+passwordHash")
            if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
                return res.status(401).json({ message: "Invalid email or password." })
            }

            return await createSession(user, res)
        }

        if (!token) {
            return res.status(400).json({ message: "A Firebase token or email and password are required." })
        }

        const allowDevLogin = process.env.ALLOW_DEV_LOGIN === "true"

        let decoded
        if (allowDevLogin && token === "dev-login") {
            decoded = {
                uid: "dev-user",
                name: "Dev User",
                email: "dev@example.com",
                picture: ""
            }
        } else {
            if (!firebaseEnabled) {
                return res.status(503).json({
                    message: "Firebase is not configured. Add a valid serviceAccountKey.json or enable ALLOW_DEV_LOGIN for local development."
                })
            }
            decoded = await getAuth(app).verifyIdToken(token)
        }

        let user = await User.findOne({ firebaseUid: decoded.uid })

        if (!user) {
            user = await User.create({
                firebaseUid: decoded.uid,
                name: decoded.name,
                email: decoded.email,
                avatar: decoded.picture
            })
        }

        return await createSession(user, res)
    } catch (error) {
        return res.status(500).json({ message: `login error ${error}` })
    }
}


export const logOut = async (req, res) => {
    try {
        const sessionId = req.cookies?.session
        await redis.del(`session-${sessionId}`)

        res.clearCookie("session")
        return res.status(200).json({ message: "logout successfully" })
    } catch (error) {
        return res.status(500).json({ message: `logout error ${error}` })
    }
}


export const updateUserPayment = async (req, res) => {
    try {
        const { plan, credits, userId } = req.body
        const user = await User.findById(userId)
        if (!user) {
            return res.status(404).json({ message: "User not found" })
        }
        user.plan = plan
        user.credits += credits
        user.totalCredits += credits
        user.planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        await user.save()

        const sessionId = await redis.get(`user-session-${user?._id}`)
        console.log("sessionId", sessionId)
        await redis.set(`session-${sessionId}`, JSON.stringify({
            userId: user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            plan: user.plan,
            credits: user.credits,
            totalCredits: user.totalCredits,
            planExpiresAt: user.planExpiresAt
        }), "EX", 7 * 24 * 60 * 60)

        return res.status(200).json({ success: true })

    } catch (error) {
        return res.status(500).json({ message: `update user payment error ${error}` })
    }
}


export const deductCredits = async (req, res) => {
    try {
        const { userId, agent } = req.body
        
        const COST = {

            chat: 1,

            search: 5,

            coding: 10,

            pdf: 10,

            ppt: 10,

            vision: 10

        };

        const user=await User.findById(userId)

        if(!user){
            return res.status(400).json({message:"user not found"})
        }

       const requiredCredits=COST[agent] || 1
        if(user.credits<requiredCredits){
         return res.status(400).json({message:"Not enough credits."})
        }
        user.credits-=requiredCredits
        await user.save()

       const sessionId = await redis.get(`user-session-${user?._id}`)
        console.log("sessionId", sessionId)
        await redis.set(`session-${sessionId}`, JSON.stringify({
            userId: user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            plan: user.plan,
            credits: user.credits,
            totalCredits: user.totalCredits,
            planExpiresAt: user.planExpiresAt
        }), "EX", 7 * 24 * 60 * 60)

        return res.status(200).json({ success: true ,credits:user.credits})
    } catch (error) {
 return res.status(500).json({ message: `deduct credits error ${error}` })
    }
}