import { Check, Code2, Copy, Eye, PanelRightClose, PanelRightOpen, X } from 'lucide-react'
import { useState } from 'react'
import { useSelector } from 'react-redux'
import { AnimatePresence, easeInOut, motion } from "motion/react"
import Editor from '@monaco-editor/react';

const allverseTheme = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '8a8a78', fontStyle: 'italic' },
    { token: 'keyword', foreground: '034f46', fontStyle: 'bold' },
    { token: 'string', foreground: 'b24d2e' },
    { token: 'number', foreground: '7d4a8f' },
    { token: 'type', foreground: '2c5f8a' },
    { token: 'function', foreground: '7a3e00' },
  ],
  colors: {
    'editor.background': '#fffdf9',
    'editor.foreground': '#1a1a1a',
    'editorLineNumber.foreground': '#1a1a1a45',
    'editorLineNumber.activeForeground': '#034f46',
    'editor.selectionBackground': '#f0d7ff',
    'editor.lineHighlightBackground': '#00000000',
    'editorCursor.foreground': '#034f46',
    'editorIndentGuide.background1': '#1a1a1a14',
    'editorIndentGuide.activeBackground1': '#1a1a1a30',
  }
}

function Artifact() {
  const [collapsed, setCollapsed] = useState(false)
  const { artifacts } = useSelector(state => state.message)
  const [tab, setTab] = useState("code")
  const [activeFile, setActiveFile] = useState(0)
  const [copied, setCopied] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  if (artifacts.length == 0) return;

  const file = artifacts[0]?.files[activeFile]
  const htmlFile = artifacts[0]?.files?.find(f => f.name == "index.html")
  const cssFile = artifacts[0]?.files?.find(f => f.name == "style.css")
  const jsFile = artifacts[0]?.files?.find(f => f.name == "script.js")

  const canPreview = Boolean(htmlFile)

  const previewDoc = `
  <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
     ${cssFile?.content || ""}
    </style>
</head>
<body>
 ${htmlFile?.content || ""} 
<script>
    ${jsFile?.content || ""}
</script>    
</body>
</html>`


  const handleCopy = async () => {
    await navigator.clipboard.writeText(file?.content || "")
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
    }, 2000)
  }

  const detectLanguage = (fileName = "") => {
    const name = fileName.toLowerCase()

    if (name.endsWith(".html"))
      return "html";

    if (name.endsWith(".css"))
      return "css";

    if (name.endsWith(".js"))
      return "javascript";

    if (name.endsWith(".jsx"))
      return "javascript";

    if (name.endsWith(".ts"))
      return "typescript";

    if (name.endsWith(".tsx"))
      return "typescript";

    if (name.endsWith(".json"))
      return "json";

    if (name.endsWith(".py"))
      return "python";

    if (name.endsWith(".java"))
      return "java";

    if (name.endsWith(".cpp"))
      return "cpp";

    if (name.endsWith(".c"))
      return "c";

    return "plaintext";

  }

  const renderPanel = (onClose) => {
    return (
      <>
        {!collapsed ? <div className='flex flex-col h-full bg-[#fffdf9]'>

          <div className='h-14 px-4 border-b border-[#1a1a1a]/10 flex items-center gap-3 shrink-0'>
            <button className='flex items-center justify-center w-7 h-7 rounded-md text-[#1a1a1a]/45 hover:text-[#034f46] hover:bg-[#e4e4d0] transition-colors duration-150 bg-transparent border-none cursor-pointer shrink-0' onClick={onClose ?? (() => setCollapsed(true))}>
              {onClose ? <X size={15} /> : <PanelRightClose size={16} />}
            </button>
            <div className='flex items-center gap-2 flex-1 min-w-0'>
              <div className='flex items-center justify-center w-6 h-6 rounded-md bg-[#034f46]/10 border border-[#034f46]/15 shrink-0'>
                <Code2 className="text-[#034f46]" size={12} />
              </div>
              <div className='text-[13px] font-semibold text-[#1a1a1a] truncate' title={artifacts[0]?.title}>{artifacts[0]?.title}</div>
            </div>

            <div className='hidden sm:flex items-center gap-1 shrink-0'>
              <button
                onClick={handleCopy}
                className='flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-[#1a1a1a]/45 hover:text-[#034f46] hover:bg-[#e4e4d0] rounded-md transition-colors duration-150 bg-transparent border-none cursor-pointer'
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
              </button>
            </div>
            {canPreview &&
              <div className='flex items-center gap-1 bg-[#e4e4d0] border border-[#1a1a1a]/10 p-1 rounded-md'>
                <button
                  onClick={() => setTab("code")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded transition-colors duration-150 cursor-pointer border-none
                  ${tab === "code" ? "bg-[#034f46] text-[#ffffeb]" : "bg-transparent text-[#1a1a1a]/45 hover:text-[#1a1a1a]"}`}
                >
                  <Code2 size={11} /> Code
                </button>
                <button
                  onClick={() => setTab("preview")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded transition-colors duration-150 cursor-pointer border-none
                  ${tab === "preview" ? "bg-[#034f46] text-[#ffffeb]" : "bg-transparent text-[#1a1a1a]/45 hover:text-[#1a1a1a]"}`}
                >
                  <Eye size={11} /> Preview
                </button>
              </div>}

          </div>
          {tab === "code" && <div className='flex h-auto border-b border-[#1a1a1a]/10 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shrink-0 bg-[#fffdf9]'>
            {
              artifacts[0]?.files?.map((f, index) => (
                <button
                  key={f?.name}
                  onClick={() => setActiveFile(index)}
                  className={`px-4 py-2.5 text-[11px] font-medium whitespace-nowrap transition-colors duration-150 border-r border-[#1a1a1a]/10 relative cursor-pointer bg-transparent   ${activeFile === index ? "text-[#034f46]" : "text-[#1a1a1a]/40 hover:text-[#1a1a1a]"}`}
                >
                  {f?.name}
                  {activeFile === index && <div className='absolute bottom-0 left-0 right-0 h-[2px] bg-[#034f46] rounded-t-full' />}

                </button>
              ))
            }
          </div>}


          <div className='flex-1 overflow-hidden'>
            {(tab == "preview" && canPreview) ? <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className='w-full h-full'
            >
              <iframe title='preview' srcDoc={previewDoc} sandbox='allow-scripts' className='w-full h-full bg-white' />
            </motion.div>
              :
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                className='w-full h-full'
              >
                <Editor
                  theme='allverse'
                  beforeMount={(monaco) => monaco.editor.defineTheme('allverse', allverseTheme)}
                  language={detectLanguage(file?.name)}
                  value={file?.content}
                  loading={<div className='flex h-full items-center justify-center gap-2 text-[12px] text-[#1a1a1a]/45'><span className='h-2 w-2 rounded-full bg-[#ff6c4c] animate-pulse' />Loading editor...</div>}
                  options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12.5, wordWrap: "on", automaticLayout: true, scrollBeyondLastLine: false, padding: { top: 16 }, lineNumbers: "on", renderLineHighlight: "none" }}

                />

              </motion.div>
            }

          </div>


        </div> :
          <div className='hidden lg:flex h-full border-l border-[#1a1a1a]/15 bg-[#fffdf9] flex-col items-center py-4 gap-3 shrink-0'>
            <button className='flex items-center justify-center w-7 h-7 rounded-md text-[#1a1a1a]/45 hover:text-[#034f46] hover:bg-[#e4e4d0] transition-colors duration-150 bg-transparent border-none cursor-pointer shrink-0' onClick={() => setCollapsed(false)}>
              <PanelRightOpen size={16} />
            </button>
            <div className='flex items-center gap-2 flex-1 min-w-0'>
              <div
                className='workspace-mono text-[10px] font-medium text-[#1a1a1a]/35 tracking-widest uppercase whitespace-nowrap'
                style={{
                  writingMode: "vertical-lr",
                  transform: "rotate(180deg)"
                }}
              >{artifacts[0]?.title}</div>
            </div>
          </div>}
      </>
    )
  }

  return (
    <>

      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed bottom-52 right-4 z-40 flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#034f46] hover:bg-[#023d36] text-[#ffffeb] text-[12px] font-medium shadow-lg border-none cursor-pointer transition-colors duration-150"

      >
        <Code2 size={13} />
        View Code
      </button>
      <AnimatePresence>
        {mobileOpen && <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={() => setMobileOpen(false)} className="lg:hidden fixed inset-0 z-50 bg-[#034f46]/40 backdrop-blur-sm" />

          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ duration: 0.25, ease: "easeInOut" }} className="lg:hidden fixed inset-y-0 right-0 z-50 w-[88vw] max-w-[420px] border-l border-[#1a1a1a]/15 bg-[#fffdf9] overflow-hidden">
            {renderPanel(() => setMobileOpen(false))}
          </motion.div>

        </>
        }

      </AnimatePresence>


      <motion.div
        initial={{ width: 400 }}
        animate={{ width: collapsed ? 48 : 400 }}
        transition={{
          duration: 0.25,
          ease: easeInOut
        }}
        className='hidden lg:flex h-full border-l border-[#1a1a1a]/15 flex-col overflow-hidden shrink-0 bg-[#fffdf9]'>

        {renderPanel()}
      </motion.div>
    </>
  )
}

export default Artifact
