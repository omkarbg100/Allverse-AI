import { MessageSquare } from 'lucide-react'
import { useSelector } from 'react-redux'

function Nav() {
const {selectedConversation}=useSelector(state=>state.conversation)
const {messages}=useSelector(state=>state.message)
  return (
<>
    {selectedConversation &&   <div className='h-14 flex items-center gap-3 pl-14 pr-4 lg:px-5 border-b border-[#1a1a1a]/10 bg-[#fffdf9] shrink-0'>
      <div className='flex items-center justify-center w-7 h-7 rounded-md bg-[#034f46]/10 border border-[#034f46]/15'>
        <MessageSquare size={13} className="text-[#034f46]"/>
      </div>
      <div className='workspace-display text-[20px] text-[#1a1a1a] tracking-tight truncate flex-1 min-w-0'>
{selectedConversation?.title || "New Chat"}
      </div>
      <div className='workspace-mono text-[10px] text-[#1a1a1a]/45 bg-[#e4e4d0] border border-[#1a1a1a]/10 px-2 py-0.5 rounded-full ml-auto shrink-0'>
        {messages?.length || 0} {messages?.length === 1 ? "message" : "messages"}
      </div>
    </div>}
  </>
  )
}

export default Nav
