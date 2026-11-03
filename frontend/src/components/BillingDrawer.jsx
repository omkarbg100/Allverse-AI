import { AnimatePresence, motion } from "motion/react"
import { Crown, X } from 'lucide-react'
import { useSelector } from 'react-redux'
import { createOrder } from '../features/createOrder'
import { verifyPayment } from '../features/verifyPayment'
function BillingDrawer({ open, onClose }) {

    const { userData } = useSelector(state => state.user)

    const handleUpgrade = async (plan) => {
        try {
            const data = await createOrder(plan)
            const options = {
                key: import.meta.env.VITE_RAZORPAY_KEY_ID,
                amount: data?.order?.amount,
                currency: data?.order?.currency,
                name: "Allverse AI",
                description: `${data?.plan?.name} Plan`,
                order_id: data?.order?.id,
                handler: async (response) => {
                    try {
                        const data = await verifyPayment(response)
                        console.log(data)
                    } catch (error) {
                        console.log(error)
                    }
                },
                theme: {
                    color: "#034F46"
                }
            }

            const razorpay = new window.Razorpay(options)
            razorpay.open()
        } catch (error) {
            console.log(error)
        }
    }
    return (
        <AnimatePresence>
            {open && <> <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-[#034f46]/55 z-[55]"
            />
                <motion.div
                    initial={{ x: "100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "100%" }}
                    transition={{ duration: .25 }}
                    className="fixed right-0 top-0 z-[60] h-screen w-[380px] bg-[#fffdf9] border-l border-[#1a1a1a]/15 shadow-2xl flex flex-col"

                >

                    <div className='flex items-center justify-between p-5 border-b border-[#1a1a1a]/10'>
                        <div>
                            <div className='workspace-display text-[26px] leading-none text-[#1a1a1a]'>
                                Billing
                            </div>
                            <div className='text-[#1a1a1a]/45 text-[12px] mt-1'>
                                Plans & Credits
                            </div>
                        </div>
                        <button onClick={onClose} className="w-9 h-9 rounded-lg bg-[#e4e4d0] hover:bg-[#f0d7ff] flex items-center justify-center border-none cursor-pointer transition-colors duration-150"
                        >
                            <X size={18} className="text-[#1a1a1a]/60" />
                        </button>
                    </div>


                    <div className='p-5'>
                        <div className='rounded-xl bg-[#e4e4d0]/55 border border-[#1a1a1a]/12 p-4'>
                            <div className='flex justify-between items-center'>
                                <div>
                                    <p className='text-[#1a1a1a]/45 text-[12px]'>
                                        Current Plan
                                    </p>
                                    <h3 className='workspace-display text-[24px] leading-tight text-[#1a1a1a]'>
                                        {userData?.plan || "free"}
                                    </h3>
                                </div>
                                <Crown className='text-[#c58a00]' />
                            </div>

                            <div className='mt-5'>
                                <div className='flex justify-between text-[11px] text-[#1a1a1a]/45 mb-2'>
                                    <span>Credits</span>
                                    <span className='workspace-mono'>{userData.credits || 0}/{userData.totalCredits || 100}</span>
                                </div>

                                <div className='h-2 rounded-full bg-[#1a1a1a]/10 overflow-hidden'>
                                    <div className="h-full bg-[#034f46] transition-all duration-500"
                                        style={{
                                            width: `${(
                                                (userData?.credits || 0) /
                                                (userData?.totalCredits || 1)
                                            ) * 100
                                                }%`
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className='px-5 flex-1 overflow-auto space-y-4'>

                        <div className='rounded-xl border border-[#1a1a1a]/12 bg-[#ffffeb] p-4'>
                            <h3 className='text-[#1a1a1a] font-semibold text-[14px]'>Starter Plan</h3>
                            <p className='text-[#034f46] text-[26px] font-semibold mt-2'>₹199</p>
                            <p className='text-[#1a1a1a]/45 text-[12px] mt-1'>500 Credits</p>
                            <button className='mt-4 w-full rounded-lg bg-[#034f46] hover:bg-[#023d36] py-2 text-[#ffffeb] text-[13px] font-semibold border-none cursor-pointer transition-colors duration-150' onClick={() => handleUpgrade("starter")}>Upgrade</button>
                        </div>
                        <div className='rounded-xl border border-[#1a1a1a]/12 bg-[#ffffeb] p-4'>
                            <h3 className='text-[#1a1a1a] font-semibold text-[14px]'>Pro Plan</h3>
                            <p className='text-[#034f46] text-[26px] font-semibold mt-2'>₹499</p>
                            <p className='text-[#1a1a1a]/45 text-[12px] mt-1'>1000 Credits</p>
                            <button className='mt-4 w-full rounded-lg bg-[#034f46] hover:bg-[#023d36] py-2 text-[#ffffeb] text-[13px] font-semibold border-none cursor-pointer transition-colors duration-150' onClick={() => handleUpgrade("pro")}>Upgrade</button>
                        </div>
                    </div>
                </motion.div>
            </>
            }

        </AnimatePresence>
    )
}

export default BillingDrawer
