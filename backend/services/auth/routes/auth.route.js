import express from "express"
import { deductCredits, login, logOut, register, updateUserPayment } from "../controllers/auth.controller.js"

const router=express.Router()

router.post("/register",register)
router.post("/login",login)
router.get("/logout",logOut)
router.post("/update-plan",updateUserPayment)
router.post("/deduct-credits",deductCredits)
export default router