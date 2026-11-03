import { useState } from 'react'
import { signInWithPopup } from 'firebase/auth'
import { auth, googleProvider } from '../../utils/firebase'
import api from '../../utils/axios'
import { FcGoogle } from "react-icons/fc"
import { Loader2, Lock, Mail, UserRound } from "lucide-react"
import { useDispatch, useSelector } from 'react-redux'
import { setUserdata } from '../redux/userSlice'
import SideBar from '../components/SideBar'
import ChatArea from '../components/ChatArea'
import Artifact from '../components/Artifact'

function Home({ onHome }) {
    const { userData } = useSelector(state => state.user)
    const dispatch = useDispatch()
    const allowDevLogin = import.meta.env.VITE_ALLOW_DEV_LOGIN === "true"
    const [mode, setMode] = useState("login")
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    const finishLogin = (data) => {
        setError("")
        dispatch(setUserdata(data))
    }

    const changeMode = (nextMode) => {
        setMode(nextMode)
        setError("")
        setPassword("")
    }

    const submitEmailAuth = async (event) => {
        event.preventDefault()
        setLoading(true)
        setError("")

        try {
            const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login"
            const payload = mode === "register"
                ? { name, email, password }
                : { email, password }
            const { data } = await api.post(endpoint, payload)
            finishLogin(data)
        } catch (requestError) {
            setError(requestError?.response?.data?.message || "Unable to sign in. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    const googleLogin = async () => {
        setLoading(true)
        setError("")

        try {
            if (!auth) {
                const { data } = await api.post("/api/auth/login", { token: "dev-login" })
                finishLogin(data)
                return
            }

            const result = await signInWithPopup(auth, googleProvider)
            const token = await result.user.getIdToken()
            const { data } = await api.post("/api/auth/login", { token })
            finishLogin(data)
        } catch (requestError) {
            setError(requestError?.response?.data?.message || requestError?.message || "Google sign-in failed.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className='workspace-root h-screen flex bg-[#ffffeb] text-[#1a1a1a] overflow-hidden'>

            <SideBar onHome={onHome} />
            <ChatArea />
            <Artifact />

            {!userData && <div className='fixed inset-0 z-50 flex items-center justify-center bg-[#034f46]/80 backdrop-blur-md p-4'>
                <div className='w-[390px] max-w-full max-h-[calc(100vh-32px)] overflow-y-auto bg-[#fffdf9] border border-[#1a1a1a]/20 rounded-[10px] p-6 flex flex-col gap-5 shadow-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
                    <div className='flex flex-col gap-3'>
                        <div className='flex items-center gap-2 text-[13px] font-bold tracking-tight text-[#1a1a1a]'>
                            <span className='h-2 w-2 rounded-full bg-[#ff6c4c]' />
                            Allverse AI
                        </div>
                        <div className='flex flex-col gap-1'>
                            <h2 className='auth-display text-[30px] leading-none text-[#1a1a1a]'>
                                {mode === "login" ? "Welcome back." : "Create your account."}
                            </h2>
                            <p className='text-[12.5px] text-[#1a1a1a]/60'>
                                {mode === "login"
                                    ? "Sign in with email or Google to continue."
                                    : "Register with email or continue with Google."}
                            </p>
                        </div>
                    </div>

                    <div className='grid grid-cols-2 gap-1 rounded-lg border border-[#1a1a1a]/15 bg-[#e4e4d0] p-1'>
                        <button
                            type='button'
                            onClick={() => changeMode("login")}
                            className={`rounded-md py-2 text-[12px] font-semibold transition-colors duration-150 cursor-pointer ${mode === "login" ? "bg-[#034f46] text-[#ffffeb]" : "text-[#1a1a1a]/55 hover:text-[#1a1a1a]"}`}
                        >
                            Sign in
                        </button>
                        <button
                            type='button'
                            onClick={() => changeMode("register")}
                            className={`rounded-md py-2 text-[12px] font-semibold transition-colors duration-150 cursor-pointer ${mode === "register" ? "bg-[#034f46] text-[#ffffeb]" : "text-[#1a1a1a]/55 hover:text-[#1a1a1a]"}`}
                        >
                            Create account
                        </button>
                    </div>

                    <form onSubmit={submitEmailAuth} className='flex flex-col gap-3'>
                        {mode === "register" && <div className='relative'>
                            <UserRound size={14} className='pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1a1a1a]/35' />
                            <input
                                type='text'
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                placeholder='Full name'
                                autoComplete='name'
                                required
                                minLength={2}
                                maxLength={80}
                                className='w-full rounded-lg border border-[#1a1a1a]/20 bg-[#ffffeb] py-2.5 pl-10 pr-3.5 text-[13px] text-[#1a1a1a] placeholder:text-[#1a1a1a]/35 outline-none transition-colors focus:border-[#034f46] focus:bg-[#fffdf9]'
                            />
                        </div>}

                        <div className='relative'>
                            <Mail size={14} className='pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1a1a1a]/35' />
                            <input
                                type='email'
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                placeholder='Email address'
                                autoComplete='email'
                                required
                                className='w-full rounded-lg border border-[#1a1a1a]/20 bg-[#ffffeb] py-2.5 pl-10 pr-3.5 text-[13px] text-[#1a1a1a] placeholder:text-[#1a1a1a]/35 outline-none transition-colors focus:border-[#034f46] focus:bg-[#fffdf9]'
                            />
                        </div>

                        <div className='relative'>
                            <Lock size={14} className='pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1a1a1a]/35' />
                            <input
                                type='password'
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                placeholder={mode === "register" ? 'Password (min. 8 characters)' : 'Password'}
                                autoComplete={mode === "register" ? 'new-password' : 'current-password'}
                                required
                                minLength={mode === "register" ? 8 : 1}
                                maxLength={128}
                                className='w-full rounded-lg border border-[#1a1a1a]/20 bg-[#ffffeb] py-2.5 pl-10 pr-3.5 text-[13px] text-[#1a1a1a] placeholder:text-[#1a1a1a]/35 outline-none transition-colors focus:border-[#034f46] focus:bg-[#fffdf9]'
                            />
                        </div>

                        {error && <p role='alert' className='rounded-lg border border-[#c9330f]/20 bg-[#ff6c4c]/15 px-3 py-2 text-[11.5px] leading-relaxed text-[#c9330f]'>{error}</p>}

                        <button
                            type='submit'
                            disabled={loading}
                            className='flex w-full items-center justify-center gap-2 rounded-lg bg-[#034f46] py-[11px] text-[13px] font-semibold text-[#ffffeb] transition-all duration-150 hover:bg-[#023d36] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer'
                        >
                            {loading && <Loader2 size={14} className='animate-spin' />}
                            {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
                        </button>
                    </form>

                    {(auth || allowDevLogin) && <div className='flex items-center gap-3 text-[10.5px] uppercase tracking-widest text-[#1a1a1a]/40'>
                        <span className='h-px flex-1 bg-[#1a1a1a]/15' />
                        or continue with
                        <span className='h-px flex-1 bg-[#1a1a1a]/15' />
                    </div>}

                    {auth && <button
                        type='button'
                        onClick={googleLogin}
                        disabled={loading}
                        className='w-full flex items-center justify-center gap-3 py-[11px] rounded-lg text-[13px] font-medium text-[#1a1a1a] bg-[#ffffeb] border border-[#1a1a1a]/20 hover:bg-[#e4e4d0] transition-all duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed'
                    >
                        <FcGoogle size={15} />
                        Continue With Google
                    </button>}

                    {!auth && allowDevLogin && <button
                        type='button'
                        onClick={googleLogin}
                        disabled={loading}
                        className='w-full flex items-center justify-center gap-3 py-[11px] rounded-lg text-[13px] font-medium text-[#1a1a1a] border border-[#1a1a1a]/20 bg-[#e4e4d0] hover:bg-[#f0d7ff] transition-all duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed'
                    >
                        Continue as Demo User
                    </button>}

                    {!auth && !allowDevLogin && <p className='text-[11px] text-[#1a1a1a]/50 text-center'>Google sign-in is unavailable until Firebase is configured.</p>}

                    {onHome && <button onClick={onHome} className='text-[11px] text-[#1a1a1a]/50 hover:text-[#1a1a1a] transition-colors duration-150 cursor-pointer bg-transparent border-none mx-auto'>Back to home</button>}
                </div>
            </div>}

        </div>
    )
}

export default Home
