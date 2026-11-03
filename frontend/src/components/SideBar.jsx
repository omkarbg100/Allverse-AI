import { Coins, Home as HomeIcon, LogOut, Menu, MessageSquare, PanelLeftIcon, PanelRight, PenSquare, Plus, User, X } from "lucide-react"
import { useState } from 'react'
import { useEffect } from 'react'
import { getConversations } from '../features/getConversations'
import { useDispatch, useSelector } from 'react-redux'
import { setConversations, setSelectedConversation } from '../redux/conversationSlice'

import logOut from '../features/logOut'
import { setUserdata } from '../redux/userSlice'
import BillingDrawer from './BillingDrawer'

function SideBar({ onHome }) {
    const [collapsed, setCollapsed] = useState(false)
    const dispatch = useDispatch()
    const [imageError, setImageError] = useState(false)
    const { conversations, selectedConversation } = useSelector(state => state.conversation)
    const { userData } = useSelector(state => state.user)
    const [showBilling, setShowBilling] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)
    const recentConversations = conversations.filter((conv) => conv?.title && conv.title !== "New Chat")

    useEffect(() => {
        const getConv = async () => {
            const data = await getConversations()
            dispatch(setConversations(data))
        }
        getConv()
    }, [userData?._id, dispatch])

    if (collapsed) {
        return (
            <div className='hidden lg:flex flex-col items-center w-[56px] h-screen bg-[#fffdf9] border-r border-[#1a1a1a]/15 py-4 gap-1 shrink-0'>
                <button className='flex items-center justify-center w-9 h-9 rounded-lg text-[#1a1a1a]/45 hover:text-[#034f46] hover:bg-[#e4e4d0] transition-colors duration-150 bg-transparent border-none cursor-pointer mb-1'
                    onClick={() => setCollapsed(false)}
                >
                    <PanelRight size={16} />
                </button>

                <button
                    className='flex items-center justify-center w-9 h-9 rounded-lg text-[#1a1a1a]/45 hover:text-[#034f46] hover:bg-[#e4e4d0] transition-colors duration-150 bg-transparent border-none cursor-pointer'
                    onClick={() => dispatch(setSelectedConversation(null))}
                >
                    <Plus size={17} />
                </button>

                <button
                    title='Back to home'
                    className='flex items-center justify-center w-9 h-9 rounded-lg text-[#1a1a1a]/45 hover:text-[#034f46] hover:bg-[#e4e4d0] transition-colors duration-150 bg-transparent border-none cursor-pointer'
                    onClick={onHome}
                >
                    <HomeIcon size={16} />
                </button>

                <div className='flex-1 overflow-y-auto px-2.5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pt-5'>
                    {recentConversations.map((conv) => {
                        const isActive = selectedConversation?._id == conv?._id
                        return (
                            <div
                                key={conv?._id}
                                title={conv?.title || "New Chat"}
                                onClick={() => { dispatch(setSelectedConversation(conv)); setMobileOpen(false) }}
                                className={`flex items-center justify-center cursor-pointer mb-0.5 px-2.5 py-2.5 rounded-lg border transition-colors duration-150
                ${isActive ? "bg-[#e4e4d0] border-[#1a1a1a]/10" : "bg-transparent border-transparent hover:bg-[#ffffeb]"}`}>
                                <div className={`flex items-center justify-center shrink-0 w-[22px] h-[22px] rounded-md transition-colors duration-150
                ${isActive ? "bg-[#034f46]/10 text-[#034f46]" : "bg-[#e4e4d0]/70 text-[#1a1a1a]/35"}`}>
                                    <MessageSquare size={13} />
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className='relative shrink-0'>
                    {
                        (userData?.avatar && !imageError)
                            ?
                            <img
                                className='w-9 h-9 rounded-lg object-cover border border-[#034f46]/25'
                                src={userData?.avatar}
                                alt="Profile"
                                onError={() => setImageError(true)} />
                            :
                            <div className='w-9 h-9 rounded-lg bg-[#e4e4d0] border border-[#1a1a1a]/10 flex items-center justify-center'>
                                <User size={15} className="text-[#1a1a1a]/45" />
                            </div>
                    }
                </div>
            </div>
        )
    }

    return (
        <>
            <button className='lg:hidden fixed top-3.5 left-4 z-50 flex items-center justify-center w-8 h-8 rounded-lg bg-[#fffdf9] border border-[#1a1a1a]/20 text-[#1a1a1a]/65 hover:text-[#034f46] shadow-sm transition-colors duration-150 cursor-pointer' onClick={() => setMobileOpen(true)}>
                <Menu size={14} />
            </button>

            {mobileOpen && <div onClick={() => setMobileOpen(false)} className='lg:hidden fixed inset-0 z-40 bg-[#034f46]/35 backdrop-blur-sm' />}

            <div className={`fixed lg:static inset-y-0 left-0 z-50
        w-[270px] h-screen shrink-0
        bg-[#fffdf9] border-r border-[#1a1a1a]/15
        transition-transform duration-250
        ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
`}>
                <div className='flex flex-col h-full'>
                    <div className='flex items-center gap-1.5 px-4 py-4 border-b border-[#1a1a1a]/10'>
                        <div className='hidden lg:flex items-center justify-center w-7 h-7 rounded-lg text-[#1a1a1a]/45 hover:text-[#034f46] hover:bg-[#e4e4d0] transition-colors duration-150 bg-transparent border-none cursor-pointer'
                            onClick={() => setCollapsed(true)}
                        >
                            <PanelLeftIcon size={15} />
                        </div>

                        <button onClick={() => setMobileOpen(false)}
                            className="lg:hidden flex items-center justify-center w-7 h-7 rounded-lg text-[#1a1a1a]/45 hover:text-[#034f46] hover:bg-[#e4e4d0] transition-colors duration-150 bg-transparent border-none cursor-pointer"
                        >
                            <X size={15} />
                        </button>

                        <span className='flex items-center gap-2 text-[15px] font-semibold text-[#1a1a1a] tracking-tight flex-1 min-w-0'>
                            <span className='h-2 w-2 shrink-0 rounded-full bg-[#ff6c4c]' />
                            <span className='truncate'>Allverse AI</span>
                        </span>

                        <button
                            title='Back to home'
                            className='flex items-center justify-center w-7 h-7 rounded-lg text-[#1a1a1a]/45 hover:text-[#034f46] hover:bg-[#e4e4d0] transition-colors duration-150 bg-transparent border-none cursor-pointer'
                            onClick={onHome}
                        >
                            <HomeIcon size={14} />
                        </button>

                        <button className='flex items-center justify-center w-7 h-7 rounded-lg text-[#1a1a1a]/45 hover:text-[#034f46] hover:bg-[#e4e4d0] transition-colors duration-150 bg-transparent border-none cursor-pointer'
                            onClick={() => { dispatch(setSelectedConversation(null)); setMobileOpen(false) }}>
                            <PenSquare size={14} />
                        </button>
                    </div>

                    <div className='px-4 pt-4 pb-1'>
                        <button className='w-full flex items-center justify-center gap-2 text-[13px] font-semibold text-[#ffffeb] bg-[#034f46] rounded-lg py-[10px] border border-[#034f46] cursor-pointer hover:bg-[#023d36] transition-colors duration-150'
                            onClick={() => { dispatch(setSelectedConversation(null)); setMobileOpen(false) }}
                        >
                            <Plus size={15} />
                            New Chat
                        </button>
                    </div>

                    {recentConversations.length == 0
                        ?
                        <div className='px-5 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#1a1a1a]/35'>
                            No Recent Conversations
                        </div>
                        :
                        (
                            <div className='px-5 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#1a1a1a]/35'>
                                Recents
                            </div>
                        )}

                    <div className='flex-1 overflow-y-auto px-2.5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
                        {recentConversations?.map((conv) => {
                            const isActive = selectedConversation?._id == conv?._id
                            return (
                                <div
                                    key={conv?._id}
                                    onClick={() => { dispatch(setSelectedConversation(conv)); setMobileOpen(false) }}
                                    className={`flex items-center gap-2.5 cursor-pointer mb-0.5 px-3 py-2.5 rounded-lg border transition-colors duration-150
                ${isActive ? "bg-[#e4e4d0] border-[#1a1a1a]/10"
                                            : "bg-transparent border-transparent hover:bg-[#ffffeb]"}`}>
                                    <div className={`flex items-center justify-center shrink-0 w-[28px] h-[28px] rounded-md transition-colors duration-150
                ${isActive ? "bg-[#034f46]/10 text-[#034f46]" : "bg-[#e4e4d0]/70 text-[#1a1a1a]/35"}`}>
                                        <MessageSquare size={13} />
                                    </div>
                                    <span className={`text-[13px] font-medium truncate ${isActive ? "text-[#1a1a1a]" : "text-[#1a1a1a]/65"}`}>
                                        {conv?.title || "New Chat"}
                                    </span>
                                </div>
                            )
                        })}
                    </div>

                    <div className='mx-2.5 h-px bg-[#1a1a1a]/10' />
                    <div className='px-3.5 py-3.5'>
                        {userData ? (
                            <div className='flex items-center gap-2.5 cursor-pointer rounded-lg px-3 py-2.5 hover:bg-[#e4e4d0]/55 transition-colors duration-150'>
                                <div className='relative shrink-0'>
                                    {
                                        (userData?.avatar && !imageError)
                                            ?
                                            <img
                                                className='w-9 h-9 rounded-lg object-cover border border-[#034f46]/25'
                                                src={userData?.avatar}
                                                alt="Profile"
                                                onError={() => setImageError(true)} />
                                            :
                                            <div className='w-9 h-9 rounded-lg bg-[#e4e4d0] border border-[#1a1a1a]/10 flex items-center justify-center'>
                                                <User size={15} className="text-[#1a1a1a]/45" />
                                            </div>
                                    }
                                </div>
                                <div className='flex-1 min-w-0'>
                                    <p className='text-[13.5px] font-semibold text-[#1a1a1a] truncate'>{userData?.name || "user"}</p>
                                    <p className='text-[11px] text-[#1a1a1a]/40 mt-px'>{userData?.plan || "free plan"} </p>
                                </div>
                                <div className='flex gap-1'>
                                    <button
                                        onClick={() => setShowBilling(true)}
                                        className='flex items-center justify-center w-7 h-7 rounded-md border-none bg-transparent text-[#c58a00] cursor-pointer hover:bg-[#e4e4d0] hover:text-[#034f46] transition-all duration-150'>
                                        <Coins size={16} />
                                    </button>
                                    <button className='flex items-center justify-center w-7 h-7 rounded-md border-none bg-transparent text-[#1a1a1a]/40 cursor-pointer hover:bg-[#e4e4d0] hover:text-[#034f46] transition-all duration-150'
                                        onClick={() => {
                                            logOut();
                                            dispatch(setUserdata(null))
                                        }}
                                    >
                                        <LogOut size={16} />
                                    </button>
                                </div>
                            </div>)
                            :
                            <button className='w-full flex items-center justify-center gap-2 text-sm font-medium text-[#1a1a1a] bg-[#e4e4d0] border border-[#1a1a1a]/15 rounded-lg py-[11px] cursor-pointer hover:bg-[#f0d7ff] transition-colors duration-150'>
                                Login
                            </button>}
                    </div>
                </div>
            </div>

            <BillingDrawer
                open={showBilling}
                onClose={() => setShowBilling(false)}
            />
        </>
    )
}

export default SideBar
