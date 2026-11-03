import { useEffect, useState } from 'react'
import {
    ArrowRight,
    BrainCircuit,
    Check,
    Code2,
    Download,
    FileText,
    Globe,
    Layers,
    Lock,
    Menu,
    MessageSquare,
    Plus,
    Presentation,
    Sparkles,
    Star,
    Wand2,
    X,
} from 'lucide-react'
import './landing.css'

const features = [
    {
        icon: Wand2,
        title: 'The right agent, chosen for you',
        description: 'Ask naturally. Allverse AI reads the request and sends it to chat, search, coding, PDF, PPT, or vision without making you pick a tool first.',
        tag: 'Auto routing',
    },
    {
        icon: BrainCircuit,
        title: 'Memory that keeps the thread',
        description: 'Redis-backed conversation history gives every follow-up the context it needs. No re-pasting, no re-explaining, no lost direction.',
        tag: 'Context',
    },
    {
        icon: Globe,
        title: 'Answers grounded in real sources',
        description: 'The search agent retrieves current information and hands it to the response, so the answer reflects the web rather than a stale training cut-off.',
        tag: 'Live search',
    },
    {
        icon: Layers,
        title: 'Artifacts, not just answers',
        description: 'Finish with files you can keep: complete code projects, downloadable PDFs, and presentation-ready decks in the same conversation.',
        tag: 'Artifacts',
    },
    {
        icon: Lock,
        title: 'Local-first by default',
        description: 'Run Ollama models through LiteLLM on your own machine, then add a cloud fallback only when you decide the work needs one.',
        tag: 'Private',
    },
]

const steps = [
    {
        label: 'Ask in plain language',
        title: 'Start with the outcome.',
        description: 'Describe what you want in the same words you would use with a teammate. Ask a question, paste a brief, drop in a document, or point at a problem.',
        proof: 'POST /api/agent/chat · agent=auto',
    },
    {
        label: 'Let the router decide',
        title: 'One request, the right specialist.',
        description: 'Auto mode chooses the agent, keeps the conversation memory, and passes context forward. Each specialist is built for a different kind of work.',
        proof: 'router → chat | search | coding | pdf | ppt',
    },
    {
        label: 'Leave with finished work',
        title: 'Open it, download it, keep going.',
        description: 'Answers stay in the thread. PDFs, decks, and code projects arrive as artifacts you can review, download, and refine in the next message.',
        proof: 'artifact ready · link expires in 10 minutes',
    },
]

const workbench = [
    {
        icon: MessageSquare,
        label: 'chat',
        title: 'Think out loud',
        description: 'A calm place for explanations, planning, and the question you have not fully formed yet.',
    },
    {
        icon: Globe,
        label: 'search',
        title: 'Bring the current web',
        description: 'Ask about what changed this week and get an answer with the latest context attached.',
    },
    {
        icon: Code2,
        label: 'code',
        title: 'Ship working files',
        description: 'Generate complete HTML, CSS, and JavaScript projects, ready to inspect and download.',
    },
    {
        icon: FileText,
        label: 'documents',
        title: 'Read the long ones',
        description: 'Upload a PDF, ask across its pages, and turn the important parts into a deck or report.',
    },
]

const quotes = [
    {
        quote: 'Auto mode is the feature I did not know I needed. I type a request, and it goes to search, code, or a PDF without me choosing a tool first.',
        name: 'Aarav Mehta',
        role: 'Product engineer',
        source: 'PRODUCT ENGINEER',
    },
    {
        quote: 'The PDF agent pulled exact answers out of a sixty-page report and cited the pages. That used to take me an entire afternoon.',
        name: 'Priya Nair',
        role: 'Research analyst',
        source: 'RESEARCH ANALYST',
    },
    {
        quote: 'Running local Ollama models through LiteLLM was the deciding factor. My data stays on my machine until I choose a cloud fallback.',
        name: 'Daniel Okafor',
        role: 'Platform engineer',
        source: 'PLATFORM ENGINEER',
    },
]

const faqs = [
    {
        question: 'Do I have to choose an agent?',
        answer: 'No. Leave Auto selected and the router picks the specialist that fits the request. If you want control, you can still choose chat, search, coding, PDF, PPT, or vision yourself.',
    },
    {
        question: 'Which models does it use?',
        answer: 'The stack is built around LiteLLM with local Ollama models by default. You can add a cloud provider key when you want a fallback or a larger model, without changing the app flow.',
    },
    {
        question: 'What can it actually produce?',
        answer: 'Conversation answers, web-grounded research, complete code projects, styled PDF documents, slide decks, and image analysis. Generated files appear as artifacts with download links.',
    },
    {
        question: 'Where do my files go?',
        answer: 'The Docker stack includes an S3-compatible local store for generated files. Uploaded PDFs stay in the workspace and retrieval runs through Qdrant.',
    },
    {
        question: 'Can I run it without cloud keys?',
        answer: 'Yes. The project is designed to run locally with Ollama, Redis, MongoDB, Qdrant, and the bundled S3-compatible store. A demo login is available for local testing.',
    },
]

const stack = ['React', 'FastAPI', 'LangGraph', 'LiteLLM', 'Ollama', 'Qdrant', 'Redis', 'MongoDB', 'Docker']

function BrandMark() {
    return (
        <a href='#top' className='brand' aria-label='Allverse AI home'>
            <span className='brand-dot' />
            <span>Allverse</span>
            <span className='brand-sub'>AI</span>
        </a>
    )
}

function StackMarquee() {
    const items = [...stack, ...stack]
    return (
        <div className='band'>
            <div className='marquee' aria-label={`Built on ${stack.join(', ')}`}>
                <span className='mq-label'>Built on</span>
                <div className='mq-clip'>
                    <div className='mq-track'>
                        {items.map((item, index) => (
                            <span key={`${item}-${index}`} className='mq-item'>
                                {item}
                                <span className='mq-sep'>·</span>
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

function ProductPreview() {
    return (
        <div className='preview' aria-label='Allverse AI workspace preview'>
            <div className='preview-top'>
                <div className='preview-dots' aria-hidden='true'>
                    <span />
                    <span />
                    <span />
                </div>
                <div className='preview-url mono'>allverse.local / workspace</div>
                <span className='preview-live'>
                    <span />
                    live
                </span>
            </div>

            <div className='preview-body'>
                <aside className='preview-side'>
                    <div className='preview-brand'>
                        <span className='brand-dot' />
                        Allverse
                    </div>
                    <div className='preview-new'>
                        <Plus size={12} />
                        New chat
                    </div>
                    <div className='preview-label mono'>Recents</div>
                    {['Q3 launch plan', 'AWS cost audit', 'Design system'].map((item, index) => (
                        <div key={item} className={`preview-thread ${index === 0 ? 'on' : ''}`}>
                            <MessageSquare size={11} />
                            {item}
                        </div>
                    ))}
                    <div className='preview-side-foot'>
                        <span className='preview-avatar'>OG</span>
                        <span>
                            <strong>Omkar</strong>
                            <small>free plan</small>
                        </span>
                    </div>
                </aside>

                <div className='preview-main'>
                    <div className='preview-head'>
                        <span className='preview-title'>Q3 launch plan</span>
                        <span className='preview-agent'>
                            Auto
                            <span className='preview-agent-dot' />
                        </span>
                    </div>

                    <div className='preview-messages'>
                        <div className='preview-msg user'>Turn this PDF into a six-slide deck and pull out the key risks.</div>
                        <div className='preview-msg assistant'>
                            <div className='preview-route'>
                                <span>PDF RAG</span>
                                <ArrowRight size={10} />
                                <span>PPT</span>
                            </div>
                            <p>Read 42 pages, extracted 8 risks, and built the deck.</p>
                            <div className='preview-checks'>
                                {['Read 42 pages', 'Extracted 8 key risks', 'Built a 6-slide deck'].map((item) => (
                                    <span key={item}>
                                        <Check size={9} />
                                        {item}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className='preview-input'>
                        <Plus size={11} />
                        Ask a follow-up or drop a file…
                        <span className='preview-send'>
                            <ArrowRight size={11} />
                        </span>
                    </div>
                </div>

                <aside className='preview-artifact'>
                    <div className='preview-artifact-head mono'>
                        Artifact
                        <span>Ready</span>
                    </div>
                    <div className='preview-file'>
                        <span className='preview-file-icon ppt'>
                            <Presentation size={13} />
                        </span>
                        <div>
                            <strong>Q3-market-review.pptx</strong>
                            <small>6 slides · generated just now</small>
                        </div>
                    </div>
                    <div className='preview-bars'>
                        <span style={{ width: '82%' }} />
                        <span style={{ width: '64%' }} />
                        <span style={{ width: '92%' }} />
                    </div>
                    <div className='preview-file'>
                        <span className='preview-file-icon pdf'>
                            <FileText size={13} />
                        </span>
                        <div>
                            <strong>source-summary.pdf</strong>
                            <small>42 pages · indexed</small>
                        </div>
                    </div>
                    <div className='preview-download'>
                        <Download size={11} />
                        Download artifacts
                    </div>
                </aside>
            </div>
        </div>
    )
}

function Landing({ onLaunch, isLoggedIn }) {
    const launchLabel = isLoggedIn ? 'Open workspace' : 'Start free'
    const [menuOpen, setMenuOpen] = useState(false)
    const [activeStep, setActiveStep] = useState(0)
    const [activeFaq, setActiveFaq] = useState(0)
    const [now, setNow] = useState(() => new Date())

    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 1000)
        return () => window.clearInterval(timer)
    }, [])

    const clock = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    })

    return (
        <div id='top' className='landing-root'>
            <div className='announce mono'>
                <span className='announce-dot' />
                Allverse AI v1.0
                <span className='announce-rule'>·</span>
                multi-agent workspace
                <a href='#how-it-works'>See how it works</a>
            </div>

            <header className='topbar'>
                <BrandMark />

                <span className='built-pill' title='Local models and cloud fallbacks through one gateway'>
                    <span className='built-pulse' />
                    Built on LiteLLM
                </span>

                <button
                    type='button'
                    className='burger'
                    aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((open) => !open)}
                >
                    {menuOpen ? <X size={16} /> : <Menu size={16} />}
                </button>

                <nav className={`nav ${menuOpen ? 'open' : ''}`} aria-label='Sections'>
                    <a href='#features' onClick={() => setMenuOpen(false)}>Features</a>
                    <a href='#how-it-works' onClick={() => setMenuOpen(false)}>How it works</a>
                    <a href='#reviews' onClick={() => setMenuOpen(false)}>Reviews</a>
                    <a href='#questions' onClick={() => setMenuOpen(false)}>Questions</a>
                </nav>

                <div className='status' role='status'>
                    <span className='pill green'>live</span>
                    <span className='status-meta mono'>local-first · v1.0</span>
                    <span className='clock'>{clock}</span>
                </div>

                <button type='button' className='topbar-cta' onClick={onLaunch}>
                    {launchLabel}
                    <ArrowRight size={13} />
                </button>
            </header>

            <main>
                <section className='hero'>
                    <div className='eyebrow'>Allverse AI · multi-agent workspace</div>
                    <h1 className='display hero-h'>
                        Every AI skill you need,
                        <em>in one calm workspace.</em>
                    </h1>
                    <p className='lede hero-sub'>
                        Ask naturally. Allverse AI routes the work to the right specialist, keeps the
                        context, and hands back answers, code, PDFs, and decks without making you
                        juggle tabs.
                    </p>

                    <div className='hero-cta'>
                        <button type='button' className='btn primary' onClick={onLaunch}>
                            {launchLabel}
                            <ArrowRight size={15} />
                        </button>
                        <a className='btn' href='#how-it-works'>See how it works</a>
                        <a className='btn ghost' href='#features'>Why Allverse</a>
                    </div>

                    <div className='hero-shot'>
                        <div className='shot-card'>
                            <ProductPreview />
                        </div>
                        <div className='ribbon-tag' aria-hidden='true'>
                            <span className='wave'>
                                <i />
                                <i />
                                <i />
                                <i />
                                <i />
                            </span>
                            auto-routed · PDF → PPT
                        </div>
                    </div>

                    <div className='faint small'>Local-first · 8 specialist agents · Docker-ready</div>
                </section>

                <StackMarquee />

                <section className='green-band'>
                    <h2 className='display'>
                        <em>One</em> workspace. Every answer accounted for.
                    </h2>
                    <p className='lede'>
                        From the first prompt to the last artifact, the conversation keeps the thread.
                        No tab-hopping, no lost context, no rebuilding the same brief twice.
                    </p>

                    <div className='stats'>
                        <div className='stat'>
                            <div className='n'>8</div>
                            <div className='l'>specialist agent modes</div>
                        </div>
                        <div className='stat'>
                            <div className='n'>1</div>
                            <div className='l'>conversation, one memory</div>
                        </div>
                        <div className='stat'>
                            <div className='n'>0</div>
                            <div className='l'>tabs to copy between</div>
                        </div>
                    </div>

                    <div className='versus'>
                        <div className='vs-card small-card'>
                            <div className='l'>Without Allverse</div>
                            <div className='n'>6 tabs</div>
                            <div className='l'>chat, editor, search, slides, docs, and a folder of exports</div>
                        </div>
                        <div className='vs-card big-card'>
                            <div className='vs-grid' aria-hidden='true'>
                                {['Auto', 'Search', 'Code', 'PDF', 'PPT', 'Vision', 'Memory', 'Files'].map((item) => (
                                    <span key={item}>{item}</span>
                                ))}
                            </div>
                            <div className='vs-inner'>
                                <div className='l'>With Allverse</div>
                                <div className='n'>1 thread</div>
                                <div className='l'>one memory, one artifact trail, on your word</div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className='section' id='how-it-works'>
                    <div className='eyebrow center'>How it works</div>
                    <h2 className='display center'>
                        Three moves, <em>from question to artifact.</em>
                    </h2>

                    <div className='features'>
                        <div className='features-list'>
                            <ul role='tablist' aria-orientation='vertical'>
                                {steps.map((step, index) => (
                                    <li key={step.label}>
                                        <button
                                            type='button'
                                            role='tab'
                                            aria-selected={activeStep === index}
                                            className={activeStep === index ? 'on' : ''}
                                            onClick={() => setActiveStep(index)}
                                        >
                                            {step.label}
                                        </button>
                                    </li>
                                ))}
                            </ul>

                            <div className='feature-card'>
                                <div className='feature-card-top mono'>
                                    <span>agent</span>
                                    <span className='feature-auto'>auto</span>
                                </div>
                                <div className='feature-flow'>
                                    <span>chat</span>
                                    <span>search</span>
                                    <span className='hot'>pdf</span>
                                    <span className='hot'>ppt</span>
                                    <span>code</span>
                                </div>
                                <div className='feature-file'>
                                    <span className='preview-file-icon ppt'>
                                        <Presentation size={13} />
                                    </span>
                                    <div>
                                        <strong>Q3-market-review.pptx</strong>
                                        <small>6 slides · artifact ready</small>
                                    </div>
                                    <Check size={13} />
                                </div>
                                <div className='feature-proof mono'>{steps[activeStep].proof}</div>
                            </div>
                        </div>

                        <div className='features-steps'>
                            {steps.map((step, index) => (
                                <article
                                    key={step.title}
                                    className={`feature-step ${activeStep === index ? 'on' : ''}`}
                                    onMouseEnter={() => setActiveStep(index)}
                                >
                                    <span className='feature-index mono'>0{index + 1}</span>
                                    <h3 className='display'>{step.title}</h3>
                                    <p className='lede'>{step.description}</p>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                <section className='section' id='features'>
                    <h2 className='display center'>
                        Built around <em>how you actually work.</em>
                    </h2>

                    <div className='pillars'>
                        {features.map((feature) => (
                            <article key={feature.title} className='pillar'>
                                <div className='pillar-top'>
                                    <span className='pillar-icon'>
                                        <feature.icon size={17} />
                                    </span>
                                    <span className='pillar-tag mono'>{feature.tag}</span>
                                </div>
                                <h3>{feature.title}</h3>
                                <p>{feature.description}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className='section'>
                    <div className='eyebrow center'>The workspace</div>
                    <h2 className='display center'>
                        Where the work <em>actually happens.</em>
                    </h2>

                    <div className='pillars four'>
                        {workbench.map((item) => (
                            <article key={item.title} className='pillar'>
                                <span className='pillar-eyebrow mono'>{item.label}</span>
                                <span className='pillar-icon small'>
                                    <item.icon size={15} />
                                </span>
                                <h3>{item.title}</h3>
                                <p>{item.description}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className='section' id='reviews'>
                    <div className='eyebrow center'>From the first users</div>
                    <h2 className='display center'>
                        Less tab-switching. <em>More finished work.</em>
                    </h2>

                    <div className='quotes'>
                        {quotes.map((quote) => (
                            <figure key={quote.name} className='quote-card'>
                                <div className='quote-stars'>
                                    {[0, 1, 2, 3, 4].map((star) => (
                                        <Star key={star} size={12} className='fill-current' />
                                    ))}
                                </div>
                                <blockquote>“{quote.quote}”</blockquote>
                                <figcaption>
                                    <span className='quote-source mono'>{quote.source}</span>
                                    <span className='quote-name'>{quote.name} · {quote.role}</span>
                                </figcaption>
                            </figure>
                        ))}
                    </div>
                </section>

                <section className='section' id='questions'>
                    <div className='eyebrow center'>FAQs</div>
                    <h2 className='display center'>Good questions.</h2>

                    <div className='faq'>
                        <div className='faq-list'>
                            {faqs.map((faq, index) => (
                                <button
                                    key={faq.question}
                                    type='button'
                                    className={activeFaq === index ? 'on' : ''}
                                    onClick={() => setActiveFaq(index)}
                                >
                                    <span>{faq.question}</span>
                                    <Plus size={14} />
                                </button>
                            ))}
                        </div>
                        <div className='faq-answer'>
                            <div className='faq-answer-top mono'>
                                <span>{faqs[activeFaq].question}</span>
                                <span>answer</span>
                            </div>
                            <p>{faqs[activeFaq].answer}</p>
                            <span className='faq-check'>
                                <Check size={13} />
                            </span>
                        </div>
                    </div>
                </section>

                <section className='section cta'>
                    <span className='cta-icon'>
                        <Sparkles size={18} />
                    </span>
                    <h2 className='display'>
                        Ready for <em>less tab-switching?</em>
                    </h2>
                    <p className='lede'>
                        Bring the question, the document, or the half-formed idea. Allverse AI brings
                        the agents, the memory, and the finished artifacts.
                    </p>
                    <div className='hero-cta'>
                        <button type='button' className='btn primary' onClick={onLaunch}>
                            {isLoggedIn ? 'Return to workspace' : 'Launch Allverse AI'}
                            <ArrowRight size={15} />
                        </button>
                        <a className='btn' href='#how-it-works'>See how it works</a>
                    </div>
                </section>
            </main>

            <footer className='footer'>
                <div className='footer-grid'>
                    <div className='footer-brand'>
                        <BrandMark />
                        <p>A multi-agent AI workspace for questions, documents, code, and the work that comes after.</p>
                        <span className='mono'>Local-first · built to self-host</span>
                    </div>

                    <div className='footer-col'>
                        <span className='footer-head mono'>Product</span>
                        <a href='#features'>Features</a>
                        <a href='#how-it-works'>How it works</a>
                        <a href='#reviews'>Reviews</a>
                        <a href='#questions'>FAQs</a>
                    </div>

                    <div className='footer-col'>
                        <span className='footer-head mono'>Run it</span>
                        <a href='#top'>Docker setup</a>
                        <a href='#top'>Local models</a>
                        <a href='#top'>API gateway</a>
                        <a href='#top'>README</a>
                    </div>

                    <div className='footer-col'>
                        <span className='footer-head mono'>Trust</span>
                        <a href='#features'>Local-first</a>
                        <a href='#features'>Data handling</a>
                        <a href='#questions'>Security notes</a>
                    </div>

                    <div className='footer-col'>
                        <span className='footer-head mono'>Project</span>
                        <a href='#top'>GitHub</a>
                        <a href='#top'>Release notes</a>
                        <a href='#top'>Contact</a>
                    </div>
                </div>

                <div className='footer-wordmark'>Allverse</div>

                <div className='footer-bottom mono'>
                    <span>© Allverse AI · multi-agent workspace</span>
                    <span className='footer-shortcuts'>
                        <a href='#top'>home</a>
                        <a href='#features'>features</a>
                        <a href='#questions'>help</a>
                    </span>
                </div>
            </footer>

            <button type='button' className='side-label' aria-label='Open the workspace' onClick={onLaunch}>
                <Sparkles size={13} />
                What is this?
            </button>
        </div>
    )
}

export default Landing
