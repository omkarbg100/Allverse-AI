import { Check, Copy, ExternalLink, FileText, X } from 'lucide-react'
import { useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import formatFileSize from '../../utils/formatFileSize'

function MessageBubble({ role, content, images, attachments = [], traceId, steps = [] }) {
  const isUser = role === "user"
  const [lightBox, setLightBox] = useState(null)
  const [copiedCode, setCopiedCode] = useState("")

  const copyCode = async (code) => {
    await navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => {
      setCopiedCode("")
    }, 2000)
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`w-fit max-w-[92vw] md:max-w-[78%]
  px-4 py-3 rounded-2xl
  break-words overflow-hidden
  leading-relaxed text-[13.5px]
        ${isUser
          ? "bg-[#034f46] text-[#ffffeb] rounded-tr-[4px] shadow-[0_2px_0_rgba(3,79,70,0.10)]"
          : "bg-[#fffdf9] border border-[#1a1a1a]/12 text-[#1a1a1a] rounded-tl-[4px] shadow-[1px_1px_3px_rgba(26,26,26,0.05)]"
        }`}>

        {attachments.length > 0 && (
          <div className='flex flex-wrap gap-2 mb-3'>
            {attachments.map((file, index) => (
              <div
                key={`${file?.name}-${index}`}
                className={`inline-flex max-w-full items-center gap-2 rounded-md border px-2.5 py-1.5 ${isUser ? 'border-[#ffffeb]/20 bg-[#ffffeb]/10' : 'border-[#1a1a1a]/12 bg-[#e4e4d0]/55'}`}
              >
                <FileText size={14} className={isUser ? 'text-[#f0d7ff]' : 'text-[#ff6c4c]'} />
                <div className='min-w-0'>
                  <p className='text-[11.5px] font-medium truncate max-w-[240px]'>{file?.name}</p>
                  {file?.size > 0 && <p className={`workspace-mono text-[9.5px] ${isUser ? 'text-[#ffffeb]/50' : 'text-[#1a1a1a]/40'}`}>{formatFileSize(file.size)}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {images.length > 0 && (
          <div className='flex flex-wrap gap-3 mt-4'>
            {images.map((img, i) => (
              <img
                key={i}
                src={img}
                onClick={() => setLightBox(img)}
                loading="lazy"
                onError={(e) => e.currentTarget.remove()}
                className="w-40 h-28 rounded-lg object-cover border border-[#1a1a1a]/15 cursor-zoom-in hover:opacity-90 transition"
              />
            ))}
          </div>
        )}

        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1 className={isUser ? 'text-2xl font-bold mt-5 mb-3' : 'workspace-display text-[28px] leading-tight mt-5 mb-3'}>{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 className={isUser ? 'text-xl font-semibold mt-4 mb-2' : 'workspace-display text-[23px] leading-tight mt-4 mb-2'}>{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 className={isUser ? 'text-lg font-semibold mt-3 mb-2' : 'workspace-display text-[20px] leading-tight mt-4 mb-2'}>{children}</h3>
            ),
            p: ({ children }) => (
              <p className='mb-3 last:mb-0 whitespace-pre-wrap break-words'>{children}</p>
            ),
            ul: ({ children }) => (
              <ul className='list-disc pl-5 space-y-1 my-2'>{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className='list-decimal pl-5 space-y-1 my-2'>{children}</ol>
            ),
            li: ({ children }) => (
              <li className='pl-0.5'>{children}</li>
            ),
            blockquote: ({ children }) => (
              <blockquote className={`border-l-2 pl-4 my-3 italic ${isUser ? 'border-[#f0d7ff]/50 text-[#ffffeb]/75' : 'border-[#034f46]/30 text-[#1a1a1a]/65'}`}>
                {children}
              </blockquote>
            ),
            table: ({ children }) => (
              <div className='overflow-x-auto my-4'>
                <table className={`min-w-full border text-[12.5px] ${isUser ? 'border-[#ffffeb]/20' : 'border-[#1a1a1a]/15'}`}>
                  {children}
                </table>
              </div>
            ),
            th: ({ children }) => (
              <th className={`border px-3 py-2 text-left font-semibold ${isUser ? 'border-[#ffffeb]/20 bg-[#ffffeb]/10' : 'border-[#1a1a1a]/15 bg-[#e4e4d0]'}`}>
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className={`border px-3 py-2 ${isUser ? 'border-[#ffffeb]/20' : 'border-[#1a1a1a]/15'}`}>
                {children}
              </td>
            ),
            a: ({ href, children }) => (
              <a href={href}
                target="_blank"
                rel="noreferrer"
                className={`underline underline-offset-2 inline-flex items-center gap-1 ${isUser ? 'text-[#f0d7ff]' : 'text-[#034f46] font-medium'}`}
              >
                {children}
                <ExternalLink size={13} />
              </a>
            ),
            code: ({ className, children }) => {
              const value = String(children).trim()

              if (!className) {
                return (
                  <code className={`px-1.5 py-0.5 rounded font-mono text-[12px] ${isUser ? 'bg-[#ffffeb]/15 text-[#ffffeb]' : 'bg-[#034f46]/10 text-[#034f46]'}`}>
                    {value}
                  </code>
                )
              }

              const language = className.replace("language-", "")

              return (
                <div className='my-4 overflow-hidden rounded-lg border border-[#1a1a1a]/20 bg-[#082f2a]'>
                  <div className='flex items-center justify-between bg-[#034f46] border-b border-[#ffffeb]/10 px-4 py-2'>
                    <span className='workspace-mono uppercase text-[10px] tracking-[0.12em] text-[#ffffeb]/65'>
                      {language}
                    </span>
                    <button className='flex items-center gap-1 text-[11px] text-[#ffffeb]/65 hover:text-[#ffffeb] transition-colors duration-150 bg-transparent border-none cursor-pointer'
                      onClick={() => copyCode(value)}>
                      {
                        copiedCode == value ?
                          <>
                            <Check size={13} />
                            Copied
                          </> :
                          <><Copy size={13} />Copy</>
                      }
                    </button>
                  </div>

                  <SyntaxHighlighter
                    language={language}
                    style={oneDark}
                    wrapLongLines
                    showLineNumbers
                    lineNumberStyle={{ color: "rgba(255,255,235,.22)" }}
                    customStyle={{
                      margin: 0,
                      padding: "16px",
                      background: "#082f2a",
                      fontSize: "12.5px",
                    }}
                  >
                    {value}
                  </SyntaxHighlighter>
                </div>
              )
            },
            img: ({ src }) => {
              if (!src) return null;
              return (
                <img
                  src={src}
                  onClick={() => setLightBox(src)}
                  loading="lazy"
                  onError={(e) => e.currentTarget.remove()}
                  className="w-40 h-28 rounded-lg object-cover border border-[#1a1a1a]/15 cursor-zoom-in hover:opacity-90 transition"
                />
              )
            }
          }}
        >
          {content}
        </Markdown>
        {steps.length > 0 && (
          <div className='mt-3 border-t border-[#1a1a1a]/10 pt-2 space-y-1'>
            <p className='workspace-mono text-[9.5px] uppercase tracking-[0.12em] text-[#1a1a1a]/35'>Request steps</p>
            {steps.map((item, index) => (
              <div key={`${item?.step}-${index}`} className='workspace-mono text-[10px] text-[#1a1a1a]/45'>
                {index + 1}. {item?.step}
              </div>
            ))}
            {traceId && (
              <div className='workspace-mono text-[9.5px] text-[#1a1a1a]/30'>trace: {traceId}</div>
            )}
          </div>
        )}
      </div>

      {lightBox &&
        <div className='fixed inset-0 z-50 bg-[#034f46]/90 backdrop-blur-sm flex items-center justify-center p-6'>
          <button
            className='absolute top-5 right-5 text-[#ffffeb]/80 hover:text-[#ffffeb] bg-[#ffffeb]/10 hover:bg-[#ffffeb]/20 transition-colors rounded-full p-2 cursor-pointer border-none'
            onClick={() => setLightBox(null)}
          >
            <X />
          </button>
          <img
            src={lightBox}
            className="max-w-[90vw] max-h-[85vh] rounded-xl border border-[#ffffeb]/20 shadow-2xl object-contain"
          />
        </div>}
    </div>
  )
}

export default MessageBubble
