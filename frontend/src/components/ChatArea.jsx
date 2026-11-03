import { useEffect, useRef } from 'react'
import Nav from './Nav'
import MessageList from './MessageList'
import ChatInput from './ChatInput'
import { useDispatch, useSelector } from 'react-redux'
import getMessages from '../features/getMessages'
import { setArtifacts, setMessages } from '../redux/messageSlice'

function ChatArea() {
  const {selectedConversation}=useSelector(state=>state.conversation)
  const dispatch=useDispatch()
  const conversationRef = useRef(selectedConversation)
  useEffect(()=>{
    conversationRef.current = selectedConversation
  })
  useEffect(()=>{
  const getMesg=async () => {
    const conversation = conversationRef.current
    if(conversation){
      if(conversation.title=="New Chat")return;
const data=await getMessages(conversation?._id)
console.log(data)
      dispatch(setMessages(data))
      const latestArtifactMessage=[...data].reverse().find(msg=>msg.artifacts && msg.artifacts.length>0)
      dispatch(setArtifacts(latestArtifactMessage?.artifacts || []))
    }
    
  }

  getMesg()
  },[selectedConversation?._id, dispatch])
  return (
    <div className='flex-1 flex flex-col min-w-0 bg-[#ffffeb]'>
      <Nav/>
      <MessageList/>
      <ChatInput/>
    </div>
  )
}

export default ChatArea
