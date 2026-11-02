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
        <div className='h-screen flex bg-[#0d0f14] text-white overflow-hidden'>

            <SideBar onHome={onHome} />
            <ChatArea />
            <Artifact />

            {!userData && <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur p-4'>
                <div className='w-[380px] max-w-full max-h-[calc(100vh-32px)] overflow-y-auto bg-[#13151c] border border-white/[0.08] rounded-2xl p-6 flex flex-col gap-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
                    <div className='flex flex-col gap-1'>
                        <h2 className='text-[18px] font-semibold text-slate-100 tracking-tight'>
                            {mode === "login" ? "Welcome back" : "Create your account"}
                        </h2>
                        <p className='text-[12.5px] text-slate-500'>
                            {mode === "login"
                                ? "Sign in with email or Google to continue."
                                : "Register with email or continue with Google."}
                        </p>
                    </div>

                    <div className='grid grid-cols-2 gap-1 rounded-xl border border-white/[0.06] bg-white/[0.03] p-1'>
                        <button
                            type='button'
                            onClick={() => changeMode("login")}
                            className={`rounded-lg py-2 text-[12px] font-medium transition-colors duration-150 cursor-pointer ${mode === "login" ? "bg-white/[0.08] text-slate-100" : "text-slate-500 hover:text-slate-300"}`}
                        >
                            Sign in
                        </button>
                        <button
                            type='button'
                            onClick={() => changeMode("register")}
                            className={`rounded-lg py-2 text-[12px] font-medium transition-colors duration-150 cursor-pointer ${mode === "register" ? "bg-white/[0.08] text-slate-100" : "text-slate-500 hover:text-slate-300"}`}
                        >
                            Create account
                        </button>
                    </div>

                    <form onSubmit={submitEmailAuth} className='flex flex-col gap-3'>
                        {mode === "register" && <div className='relative'>
                            <UserRound size={14} className='pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600' />
                            <input
                                type='text'
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                placeholder='Full name'
                                autoComplete='name'
                                required
                                minLength={2}
                                maxLength={80}
                                className='w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 pl-10 pr-3.5 text-[13px] text-slate-200 placeholder:text-slate-600 outline-none transition-colors focus:border-indigo-500/50 focus:bg-white/[0.05]'
                            />
                        </div>}

                        <div className='relative'>
                            <Mail size={14} className='pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600' />
                            <input
                                type='email'
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                placeholder='Email address'
                                autoComplete='email'
                                required
                                className='w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 pl-10 pr-3.5 text-[13px] text-slate-200 placeholder:text-slate-600 outline-none transition-colors focus:border-indigo-500/50 focus:bg-white/[0.05]'
                            />
                        </div>

                        <div className='relative'>
                            <Lock size={14} className='pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600' />
                            <input
                                type='password'
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                placeholder={mode === "register" ? 'Password (min. 8 characters)' : 'Password'}
                                autoComplete={mode === "register" ? 'new-password' : 'current-password'}
                                required
                                minLength={mode === "register" ? 8 : 1}
                                maxLength={128}
                                className='w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 pl-10 pr-3.5 text-[13px] text-slate-200 placeholder:text-slate-600 outline-none transition-colors focus:border-indigo-500/50 focus:bg-white/[0.05]'
                            />
                        </div>

                        {error && <p role='alert' className='rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[11.5px] leading-relaxed text-rose-300'>{error}</p>}

                        <button
                            type='submit'
                            disabled={loading}
                            className='flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 py-[11px] text-[13px] font-semibold text-white transition-all duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer'
                        >
                            {loading && <Loader2 size={14} className='animate-spin' />}
                            {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
                        </button>
                    </form>

                    {(auth || allowDevLogin) && <div className='flex items-center gap-3 text-[10.5px] uppercase tracking-widest text-slate-600'>
                        <span className='h-px flex-1 bg-white/[0.06]' />
                        or continue with
                        <span className='h-px flex-1 bg-white/[0.06]' />
                    </div>}

                    {auth && <button
                        type='button'
                        onClick={googleLogin}
                        disabled={loading}
                        className='w-full flex items-center justify-center gap-3 py-[11px] rounded-xl text-[13px] font-medium text-black/90 bg-white hover:bg-gray-200 transition-all duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed'
                    >
                        <FcGoogle size={15} />
                        Continue With Google
                    </button>}

                    {!auth && allowDevLogin && <button
                        type='button'
                        onClick={googleLogin}
                        disabled={loading}
                        className='w-full flex items-center justify-center gap-3 py-[11px] rounded-xl text-[13px] font-medium text-slate-200 border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] transition-all duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed'
                    >
                        Continue as Demo User
                    </button>}

                    {!auth && !allowDevLogin && <p className='text-[11px] text-slate-600 text-center'>Google sign-in is unavailable until Firebase is configured.</p>}

                    {onHome && <button onClick={onHome} className='text-[11px] text-slate-600 hover:text-slate-300 transition-colors duration-150 cursor-pointer bg-transparent border-none mx-auto'>Back to home</button>}
                </div>
            </div>}

        </div>
    )
}

export default Home
