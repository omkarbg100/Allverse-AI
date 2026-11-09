import { useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import MessageBubble from './MessageBubble'
import LoadingAnimation from './LoadingAnimation'

function MessageList() {
    const {selectedConversation}=useSelector(state=>state.conversation)
    const {messages,isLoading}=useSelector(state=>state.message)
    const bottemRef=useRef(null)
   
   useEffect(()=>{
       requestAnimationFrame(()=>{
        bottemRef?.current?.scrollIntoView({
          behavior:"smooth",
          block:"end"
        })
       })
   },[messages?.length,isLoading])


  return (
    <div className='flex-1 overflow-y-auto px-5 md:px-8 py-8 space-y-5 bg-[#ffffeb] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
      
      {messages.length==0 || !selectedConversation ?(
        <div className="h-full flex flex-col items-center justify-center gap-6 text-center px-4">
           <div className='flex flex-col items-center gap-3'>
               <span className='workspace-mono inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.16em] text-[#ff6c4c]'>
                   <span className='h-1.5 w-1.5 rounded-full bg-[#ff6c4c]' />
                   Multi-agent workspace
               </span>
               <h1 className='workspace-display text-[44px] md:text-[58px] leading-[0.92] text-[#1a1a1a] max-w-[12ch]'>
                   How can I help you?
               </h1>
               <p className='text-[13.5px] text-[#1a1a1a]/50 max-w-[340px] leading-relaxed'>
                   Ask me anything — code, ideas, explanations, documents, or just a quick question.
               </p>
           </div>
           <div className='flex flex-col items-center gap-3 mt-1'>
             <span className='text-[10px] font-semibold uppercase tracking-[0.14em] text-[#1a1a1a]/35'>Try one of these</span>
             <div className='flex flex-wrap justify-center gap-2'>
              {["Write a Netflix clone", "Explain Redis", "Build a dashboard"].map((s)=>(
                <button key={s} className='text-[12px] font-medium text-[#1a1a1a]/65 bg-[#fffdf9] border border-[#1a1a1a]/15 px-4 py-2 rounded-lg hover:bg-[#e4e4d0] hover:text-[#1a1a1a] transition-colors duration-150 cursor-pointer'>
                  {s}
                </button>
              ))}
             </div>
           </div>
           <p className='workspace-mono text-[10px] text-[#1a1a1a]/30 mt-2'>Choose an agent below, or let Auto route it.</p>
        </div>
      ):
      <div className='max-w-[900px] mx-auto space-y-5'>

        {messages?.map((msg, index)=>(
            <div key={`${msg?.role}-${index}`}>
                <MessageBubble role={msg?.role} content={msg?.content} images={msg.images || []} attachments={msg.attachments || []} traceId={msg.traceId} steps={msg.steps || []} />
            </div>
        ))}

        {isLoading && <LoadingAnimation/>}

        
      </div>
      }
      <div ref={bottemRef}/>
    </div>
  )
}

export default MessageList
