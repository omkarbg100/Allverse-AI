import { Code2, FileText, Globe, ImageIcon, MessageSquare, Mic, MicOff, Paperclip, Presentation, Send, X, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import sendMessage from '../features/sendMessage'
import { useDispatch, useSelector } from 'react-redux'
import { addMessage, setArtifacts, setIsLoading, setMessages } from '../redux/messageSlice'
import { createConversation } from '../features/createConversation'
import { addConversation, setConvTitle, setSelectedConversation } from '../redux/conversationSlice'
import { updateConversation } from '../features/updateConversation'
import { useRef } from 'react'
import formatFileSize from '../../utils/formatFileSize'


function ChatInput() {
  const [value, setValue] = useState("")
  const [selectedAgent, setSelectedAgent] = useState("Auto")
  const { selectedConversation } = useSelector(state => state.conversation)
  const { isLoading } = useSelector(state => state.message)
  const [selectedFile, setSelectedFile] = useState(null)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef(null)
  const fileRef = useRef(null)
  const dispatch = useDispatch()


  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition()
    recognition.lang = "en-US"
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event) => {
      let transcript = ""

      for (let index = event.resultIndex; index < event.results.length; index++) {

        transcript += event.results[index][0].transcript
      }
      setValue(transcript)
    }

    recognition.onend = () => {
      setListening(false)
    }

    recognitionRef.current = recognition
  }, [])

  const toggleMic = () => {
    if (!recognitionRef.current) {
      alert("speech recognition not supported")
      return
    }
    if (listening) {
      recognitionRef.current.stop()
      setListening(false)
    } else {
      recognitionRef.current.start()
      setListening(true)
    }
  }

  const handleSendMessage = async () => {
    if (!value.trim() || isLoading) return;
    dispatch(setIsLoading(true))
    let conversation = selectedConversation
    if (!conversation) {
      dispatch(setMessages([]))
      const conv = await createConversation()
      dispatch(setSelectedConversation(conv))

      dispatch(addConversation(conv))
      conversation = conv
    }

    if (conversation.title == "New Chat") {
      await updateConversation({ id: conversation?._id, title: value.trim() })
      dispatch(setConvTitle({ conversationId: conversation?._id, title: value.slice(0, 40) }))
    }

    const formData = new FormData()
    formData.append("prompt", value.trim())
    formData.append("conversationId", conversation?._id)
    formData.append("agent", selectedAgent.toLowerCase())
    if (selectedFile) {
      formData.append("file", selectedFile)
    }

    const attachment = selectedFile
      ? { name: selectedFile.name, type: selectedFile.type, size: selectedFile.size }
      : null

    dispatch(addMessage({
      role: "user",
      content: value.trim(),
      attachments: attachment ? [attachment] : [],
    }))
    setValue("")
    setSelectedFile(null)
    if (fileRef.current) fileRef.current.value = ""

    const data = await sendMessage(formData)
    dispatch(setIsLoading(false))
    if (!data) {
      dispatch(addMessage({ role: "assistant", content: "Something went wrong while sending that message. Please try again." }))
      return
    }
    dispatch(setArtifacts(data.artifacts || []))
    dispatch(addMessage({ role: "assistant", content: data?.answer, images: data?.images, traceId: data?.trace_id, steps: data?.steps || [] }))
  }

  const agents = [
    {
      id: "auto",
      icon: Zap,
      label: "Auto"
    },

    {
      id: "chat",
      icon: MessageSquare,
      label: "Chat"
    },

    {
      id: "coding",
      icon: Code2,
      label: "Coding"
    },

    {
      id: "pdf",
      icon: FileText,
      label: "PDF"
    },

    {
      id: "ppt",
      icon: Presentation,
      label: "PPT"
    },

    {
      id: "vision",
      icon: ImageIcon,
      label: "Vision"
    },

    {
      id: "search",
      icon: Globe,
      label: "Search"
    }

  ]

  return (
    <div className='w-full px-3 md:px-6 py-4 border-t border-[#1a1a1a]/10 bg-[#ffffeb]'>
      <div className='max-w-[900px] mx-auto flex flex-col gap-2 bg-[#fffdf9] border border-[#1a1a1a]/18 rounded-xl px-4 pt-3.5 pb-3 shadow-[2px_2px_0_rgba(26,26,26,0.04)] transition-colors duration-150 focus-within:border-[#034f46]/35'>

        <div className='flex w-full gap-1.5 pr-2 flex-wrap'>
          {agents.map((agent) => {
            const isActive = selectedAgent === agent.label
            const Icon = agent.icon
            return (
              <button
                key={agent.id}
                type='button'
                onClick={() => setSelectedAgent(agent.label)}
                className={`
            flex-shrink-0
            cursor-pointer
            inline-flex
            items-center
            gap-1.5
            px-2.5
            py-1.5
            rounded-md
            text-[11.5px]
            font-medium
            border
            transition-colors
            duration-150

            ${isActive
                    ? "bg-[#034f46] text-[#ffffeb] border-[#034f46] shadow-[1px_1px_0_rgba(3,79,70,0.18)]"
                    : "bg-[#ffffeb] text-[#1a1a1a]/55 border-[#1a1a1a]/12 hover:bg-[#e4e4d0] hover:text-[#1a1a1a]"
                  }
          `}>

                <Icon size={13}
                  className={
                    isActive
                      ? "text-[#ffffeb]"
                      : "text-[#1a1a1a]/40"
                  } />

                {agent.label}

              </button>
            )

          })}
        </div>

        {
          selectedFile && <div className='my-2'>

            <div className='inline-flex items-center gap-2.5 rounded-lg border border-[#1a1a1a]/15 bg-[#e4e4d0]/55 px-3 py-2'>
              {
                selectedFile?.type === "application/pdf" ? <FileText size={16}
                  className="text-[#ff6c4c]"
                /> : selectedFile.type.startsWith("image/") && <img src={URL.createObjectURL(selectedFile)} className="h-10 w-10 rounded-md object-cover border border-[#1a1a1a]/10"
                />
              }

              <div>
                <p className='text-[12px] text-[#1a1a1a] max-w-[220px] truncate'>
                  {selectedFile?.name}
                </p>
                <p className='workspace-mono text-[10px] text-[#1a1a1a]/40'>
                  {formatFileSize(selectedFile.size)}
                </p>

              </div>
              <button className='ml-2 bg-transparent border-none cursor-pointer' onClick={() => { setSelectedFile(null); fileRef.current.value = "" }}><X size={14} className='text-[#1a1a1a]/40 hover:text-[#034f46]' /></button>
            </div>


          </div>
        }


        <textarea
          placeholder='Ask anything...'
          onChange={(e) => setValue(e.target.value)}
          value={value}
          className="w-full bg-transparent outline-none resize-none text-[13.5px] text-[#1a1a1a] placeholder:text-[#1a1a1a]/30 leading-relaxed [scrollbar-width:none] [&::-webkit-scrollbar]:hidden disabled:opacity-50"
          rows={3}
        />
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-1'>

            <input type="file" accept='.pdf,image/*' hidden ref={fileRef} onChange={(e) => {
              const file = e.target.files[0]
              if (file) {
                setSelectedFile(file)
              }
            }} />

            <button className='flex items-center justify-center w-8 h-8 rounded-md text-[#1a1a1a]/40 hover:text-[#034f46] hover:bg-[#e4e4d0]/60 border border-transparent transition-colors duration-150 bg-transparent cursor-pointer' onClick={() => fileRef.current.click()}>
              <Paperclip size={16} />
            </button>
            <button
              onClick={toggleMic}
              className={`flex items-center justify-center w-8 h-8 rounded-md border border-transparent transition-colors duration-150 cursor-pointer ${listening ? "bg-[#ff6c4c] text-[#ffffeb]" : "text-[#1a1a1a]/40 hover:text-[#034f46] hover:bg-[#e4e4d0]/60"}`}>
              {listening ? <Mic size={16} /> : <MicOff size={16} />}
            </button>
          </div>
          <button
            disabled={!value.trim() || isLoading}
            onClick={handleSendMessage}
            className={`flex items-center justify-center w-8 h-8 rounded-md border-none cursor-pointer transition-colors duration-150 ${value.trim() && !isLoading ? "bg-[#034f46] hover:bg-[#023d36] text-[#ffffeb]" : "bg-[#e4e4d0] text-[#1a1a1a]/25 cursor-not-allowed"}`}>
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChatInput
