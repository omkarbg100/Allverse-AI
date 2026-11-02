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
    MessageSquare,
    Presentation,
    Sparkles,
    Star,
    Upload,
    Wand2,
    Zap,
} from 'lucide-react'

const features = [
    {
        icon: Zap,
        title: 'Auto-routing multi-agent system',
        description: 'Ask naturally. CortexAI detects intent and sends your request to the right specialist agent instead of forcing one model to do everything.',
        tag: 'Smart routing',
    },
    {
        icon: BrainCircuit,
        title: 'Memory that keeps the thread',
        description: 'Redis-backed conversation memory gives every follow-up the context it needs, so you never have to repeat yourself or paste old answers back in.',
        tag: 'Context aware',
    },
    {
        icon: Globe,
        title: 'Answers grounded in real sources',
        description: 'The search agent retrieves current web information and feeds it into the response, so answers stay relevant instead of dated.',
        tag: 'Live search',
    },
    {
        icon: Code2,
        title: 'From prompt to working project',
        description: 'The coding agent generates complete HTML, CSS, and JavaScript projects, then hands them back as editable files in the artifact panel.',
        tag: 'Build artifacts',
    },
    {
        icon: FileText,
        title: 'Documents become conversations',
        description: 'Upload PDFs and ask questions across their contents. Semantic retrieval with Qdrant finds the passages that matter.',
        tag: 'PDF + RAG',
    },
    {
        icon: Presentation,
        title: 'Decks and visuals in minutes',
        description: 'Turn briefs and reports into presentation-ready slide decks, and analyze or generate images without leaving the workspace.',
        tag: 'PPT + vision',
    },
]

const steps = [
    {
        number: '01',
        icon: MessageSquare,
        title: 'Start in seconds',
        description: 'Open the workspace and sign in with Google or use the local demo login. No long setup, no plugin maze.',
    },
    {
        number: '02',
        icon: Wand2,
        title: 'Ask or choose an agent',
        description: 'Leave Auto selected and let CortexAI route the request, or pick chat, search, coding, PDF, PPT, or vision yourself.',
    },
    {
        number: '03',
        icon: Upload,
        title: 'Add the context',
        description: 'Drop in a PDF or image, ask for a web-grounded answer, or simply describe the outcome you want.',
    },
    {
        number: '04',
        icon: Layers,
        title: 'Leave with finished work',
        description: 'Get an answer you can keep, files you can download, and memory that carries the conversation forward.',
    },
]

const reviews = [
    {
        name: 'Aarav Mehta',
        role: 'Product engineer',
        quote: 'Auto mode is the feature I did not know I needed. I type a request, and it goes to search, code, or a PDF without me choosing a tool first.',
        initials: 'AM',
        color: 'from-indigo-500 to-violet-600',
    },
    {
        name: 'Sofia Kim',
        role: 'Startup founder',
        quote: 'I stopped bouncing between a chatbot, an editor, and slide software. The artifact panel means I actually leave with files at the end.',
        initials: 'SK',
        color: 'from-cyan-500 to-blue-600',
    },
    {
        name: 'Daniel Okafor',
        role: 'Platform engineer',
        quote: 'Running local Ollama models through LiteLLM was the deciding factor. My data stays on my machine until I choose a cloud fallback.',
        initials: 'DO',
        color: 'from-emerald-500 to-teal-600',
    },
    {
        name: 'Priya Nair',
        role: 'Research analyst',
        quote: 'The PDF agent pulled exact answers out of a sixty-page report and cited the pages. That used to take me an entire afternoon.',
        initials: 'PN',
        color: 'from-rose-500 to-pink-600',
    },
    {
        name: 'Lucas Martin',
        role: 'Indie developer',
        quote: 'The coding agent generated a complete responsive site and handed me clean files. I reviewed them, made one tweak, and shipped.',
        initials: 'LM',
        color: 'from-amber-500 to-orange-600',
    },
    {
        name: 'Hana Sato',
        role: 'AI product designer',
        quote: 'It feels like one workspace instead of a pile of tabs. Conversation memory keeps the design direction consistent across follow-ups.',
        initials: 'HS',
        color: 'from-fuchsia-500 to-purple-600',
    },
]

const stack = ['React', 'FastAPI', 'LangGraph', 'LiteLLM', 'Ollama', 'Qdrant', 'Redis', 'MongoDB']

function Stars() {
    return (
        <div className='flex items-center gap-0.5 text-amber-400'>
            {[0, 1, 2, 3, 4].map((star) => (
                <Star key={star} size={13} className='fill-amber-400' />
            ))}
        </div>
    )
}

function Landing({ onLaunch, isLoggedIn }) {
    const launchLabel = isLoggedIn ? 'Open workspace' : 'Launch app'

    return (
        <div id='top' className='min-h-screen scroll-smooth overflow-x-hidden bg-[#0d0f14] text-white'>
            <div className='pointer-events-none fixed inset-0 overflow-hidden'>
                <div className='absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-[140px]' />
                <div className='absolute right-[-180px] top-[520px] h-[420px] w-[420px] rounded-full bg-violet-600/10 blur-[120px]' />
                <div className='absolute bottom-[-200px] left-[-160px] h-[420px] w-[420px] rounded-full bg-cyan-500/10 blur-[120px]' />
            </div>

            <header className='sticky top-0 z-50 border-b border-white/[0.06] bg-[#0d0f14]/85 backdrop-blur-xl'>
                <div className='mx-auto flex max-w-6xl items-center justify-between px-5 py-4'>
                    <a href='#top' className='flex items-center gap-2.5'>
                        <span className='flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-700 shadow-lg shadow-indigo-500/25'>
                            <Sparkles size={17} />
                        </span>
                        <span className='text-[17px] font-semibold tracking-tight'>
                            Cortex<span className='text-indigo-400'>AI</span>
                        </span>
                    </a>

                    <nav className='hidden items-center gap-8 text-[13px] font-medium text-slate-400 md:flex'>
                        <a href='#features' className='transition-colors hover:text-white'>Why CortexAI</a>
                        <a href='#how-it-works' className='transition-colors hover:text-white'>How it works</a>
                        <a href='#reviews' className='transition-colors hover:text-white'>Reviews</a>
                    </nav>

                    <button
                        onClick={onLaunch}
                        className='flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-900 transition-colors duration-150 hover:bg-slate-200'
                    >
                        {launchLabel}
                        <ArrowRight size={15} />
                    </button>
                </div>
            </header>

            <main>
                <section className='relative mx-auto max-w-6xl px-5 pb-16 pt-20 text-center md:pt-28'>
                    <div className='mx-auto flex w-fit items-center gap-2 rounded-full border border-indigo-500/25 bg-indigo-500/10 px-3.5 py-1.5 text-[11px] font-medium tracking-wide text-indigo-300'>
                        <Sparkles size={12} />
                        Multi-agent AI workspace
                    </div>

                    <h1 className='mx-auto mt-6 max-w-4xl text-4xl font-semibold leading-[1.08] tracking-tight text-slate-50 sm:text-5xl md:text-6xl'>
                        Every AI skill you need,
                        <span className='block bg-gradient-to-r from-indigo-300 via-violet-300 to-cyan-300 bg-clip-text text-transparent'>
                            in one calm workspace.
                        </span>
                    </h1>

                    <p className='mx-auto mt-6 max-w-2xl text-[15px] leading-relaxed text-slate-400 md:text-[16px]'>
                        CortexAI routes each request to the right specialist agent. Chat, search, code,
                        read documents, build decks, and understand images without switching tabs or
                        losing context.
                    </p>

                    <div className='mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row'>
                        <button
                            onClick={onLaunch}
                            className='group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-6 py-3.5 text-[14px] font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-150 hover:brightness-110 sm:w-auto'
                        >
                            Start free
                            <ArrowRight size={16} className='transition-transform duration-150 group-hover:translate-x-0.5' />
                        </button>
                        <a
                            href='#how-it-works'
                            className='flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.03] px-6 py-3.5 text-[14px] font-medium text-slate-300 transition-colors duration-150 hover:bg-white/[0.06] hover:text-white sm:w-auto'
                        >
                            See how it works
                        </a>
                    </div>

                    <p className='mt-4 text-[11.5px] text-slate-600'>
                        Local-first · OpenAI-compatible · Self-hosted with Docker
                    </p>

                    <div className='relative mx-auto mt-14 max-w-4xl rounded-2xl border border-white/[0.08] bg-[#101218]/90 p-2.5 shadow-2xl shadow-black/50'>
                        <div className='flex items-center gap-2 border-b border-white/[0.06] px-3 py-2'>
                            <span className='h-2.5 w-2.5 rounded-full bg-rose-500/70' />
                            <span className='h-2.5 w-2.5 rounded-full bg-amber-500/70' />
                            <span className='h-2.5 w-2.5 rounded-full bg-emerald-500/70' />
                            <span className='ml-2 text-[11px] font-medium text-slate-600'>CortexAI workspace</span>
                        </div>

                        <div className='grid gap-3 p-3 text-left md:grid-cols-[1.15fr_0.85fr]'>
                            <div className='flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-[#0d0f14] p-4'>
                                <div className='ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-indigo-500 to-violet-700 px-4 py-2.5 text-[12.5px] leading-relaxed text-white'>
                                    Analyze this PDF and turn the key findings into a short slide deck.
                                </div>
                                <div className='flex items-center gap-2'>
                                    <span className='rounded-full border border-indigo-500/25 bg-indigo-500/10 px-2.5 py-1 text-[10px] font-medium text-indigo-300'>
                                        Auto
                                    </span>
                                    <ArrowRight size={11} className='text-slate-700' />
                                    <span className='rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium text-slate-400'>
                                        PDF RAG
                                    </span>
                                    <ArrowRight size={11} className='text-slate-700' />
                                    <span className='rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium text-slate-400'>
                                        PPT
                                    </span>
                                </div>
                                <div className='max-w-[92%] rounded-2xl rounded-tl-sm border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-[12.5px] leading-relaxed text-slate-300'>
                                    <div className='mb-2 flex items-center gap-2 text-[11px] font-medium text-slate-500'>
                                        <BrainCircuit size={13} className='text-indigo-400' />
                                        Working through your request
                                    </div>
                                    <div className='flex flex-col gap-1.5'>
                                        {['Read 42 pages', 'Extracted 8 key insights', 'Built a 6-slide deck'].map((item) => (
                                            <div key={item} className='flex items-center gap-2'>
                                                <span className='flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400'>
                                                    <Check size={10} />
                                                </span>
                                                {item}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className='mt-1 flex items-center gap-2 rounded-xl border border-white/[0.07] bg-[#111318] px-3 py-2.5 text-[11.5px] text-slate-600'>
                                    <PlusIcon />
                                    Ask a follow-up or drop a file…
                                </div>
                            </div>

                            <div className='flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-[#0d0f14] p-4'>
                                <div className='flex items-center justify-between'>
                                    <span className='text-[10px] font-semibold uppercase tracking-widest text-slate-600'>Artifact</span>
                                    <span className='flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400'>
                                        <Check size={10} />
                                        Ready
                                    </span>
                                </div>
                                <div className='mt-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3'>
                                    <div className='flex items-center gap-2'>
                                        <span className='flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10 text-orange-400'>
                                            <Presentation size={15} />
                                        </span>
                                        <div>
                                            <p className='text-[12px] font-medium text-slate-200'>Q3-market-review.pptx</p>
                                            <p className='text-[10px] text-slate-600'>6 slides · generated just now</p>
                                        </div>
                                    </div>
                                    <div className='mt-3 flex flex-col gap-1.5'>
                                        {[80, 65, 90].map((width, index) => (
                                            <div key={index} className='h-1.5 rounded-full bg-white/[0.05]'>
                                                <div className='h-full rounded-full bg-indigo-500/40' style={{ width: `${width}%` }} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className='mt-1 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3'>
                                    <div className='flex items-center gap-2'>
                                        <span className='flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400'>
                                            <FileText size={15} />
                                        </span>
                                        <div>
                                            <p className='text-[12px] font-medium text-slate-200'>source-summary.pdf</p>
                                            <p className='text-[10px] text-slate-600'>42 pages · indexed</p>
                                        </div>
                                    </div>
                                </div>
                                <div className='mt-auto flex items-center justify-center gap-2 rounded-lg bg-white/[0.04] py-2 text-[11px] font-medium text-slate-400'>
                                    <Download size={12} />
                                    Download artifacts
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className='mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3'>
                        {[
                            { value: '8', label: 'specialist agent modes' },
                            { value: 'Local + cloud', label: 'models through LiteLLM' },
                            { value: 'Memory + RAG', label: 'Redis and Qdrant backed' },
                        ].map((stat) => (
                            <div key={stat.label} className='rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3'>
                                <p className='text-[15px] font-semibold text-slate-200'>{stat.value}</p>
                                <p className='mt-0.5 text-[11px] text-slate-500'>{stat.label}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className='border-y border-white/[0.06] bg-white/[0.015]'>
                    <div className='mx-auto flex max-w-6xl flex-col items-center gap-4 px-5 py-7 md:flex-row md:justify-between'>
                        <p className='text-[10.5px] font-semibold uppercase tracking-[0.18em] text-slate-600'>
                            Built on an open, dependable stack
                        </p>
                        <div className='flex flex-wrap items-center justify-center gap-2'>
                            {stack.map((item) => (
                                <span key={item} className='rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-slate-400'>
                                    {item}
                                </span>
                            ))}
                        </div>
                    </div>
                </section>

                <section id='features' className='mx-auto max-w-6xl px-5 py-20 md:py-24'>
                    <div className='max-w-2xl'>
                        <p className='text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-400'>Why CortexAI</p>
                        <h2 className='mt-3 text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl'>
                            One workspace that adapts to the work
                        </h2>
                        <p className='mt-4 text-[14.5px] leading-relaxed text-slate-400'>
                            Most AI tools make you choose a model, then manage the context yourself.
                            CortexAI chooses the right workflow, remembers the thread, and gives you
                            something you can actually use.
                        </p>
                    </div>

                    <div className='mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
                        {features.map((feature) => (
                            <article
                                key={feature.title}
                                className='group rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 transition-all duration-150 hover:border-indigo-500/25 hover:bg-indigo-500/[0.04]'
                            >
                                <div className='flex items-center justify-between'>
                                    <span className='flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-400'>
                                        <feature.icon size={18} />
                                    </span>
                                    <span className='rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium text-slate-500'>
                                        {feature.tag}
                                    </span>
                                </div>
                                <h3 className='mt-4 text-[15px] font-semibold tracking-tight text-slate-100'>{feature.title}</h3>
                                <p className='mt-2 text-[12.5px] leading-relaxed text-slate-500'>{feature.description}</p>
                            </article>
                        ))}
                    </div>

                    <div className='mt-6 grid gap-4 rounded-2xl border border-white/[0.07] bg-gradient-to-r from-indigo-500/[0.08] via-violet-500/[0.05] to-transparent p-6 md:grid-cols-3 md:p-7'>
                        {[
                            { icon: Layers, title: 'One workspace, not five tabs', text: 'Chat, search, code, documents, and slides share one conversation and one memory.' },
                            { icon: Lock, title: 'Private by default', text: 'Run local models through Ollama, or add a cloud provider only when you choose to.' },
                            { icon: Zap, title: 'Built for momentum', text: 'Auto-routing removes tool decisions so you can stay focused on the actual problem.' },
                        ].map((item) => (
                            <div key={item.title} className='flex gap-3'>
                                <item.icon size={17} className='mt-0.5 shrink-0 text-indigo-400' />
                                <div>
                                    <p className='text-[13px] font-semibold text-slate-200'>{item.title}</p>
                                    <p className='mt-1 text-[11.5px] leading-relaxed text-slate-500'>{item.text}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section id='how-it-works' className='border-y border-white/[0.06] bg-white/[0.015]'>
                    <div className='mx-auto max-w-6xl px-5 py-20 md:py-24'>
                        <div className='max-w-2xl'>
                            <p className='text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-400'>How it works</p>
                            <h2 className='mt-3 text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl'>
                                Four steps from question to finished work
                            </h2>
                            <p className='mt-4 text-[14.5px] leading-relaxed text-slate-400'>
                                No prompt engineering course, no workflow builder, and no tab juggling.
                                Start a conversation and let the workspace do the routing.
                            </p>
                        </div>

                        <div className='relative mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
                            {steps.map((step) => (
                                <div key={step.number} className='relative rounded-2xl border border-white/[0.07] bg-[#0d0f14] p-5'>
                                    <div className='flex items-center justify-between'>
                                        <span className='flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-400'>
                                            <step.icon size={16} />
                                        </span>
                                        <span className='text-[22px] font-semibold tracking-tight text-white/[0.08]'>{step.number}</span>
                                    </div>
                                    <h3 className='mt-5 text-[14px] font-semibold text-slate-100'>{step.title}</h3>
                                    <p className='mt-2 text-[12px] leading-relaxed text-slate-500'>{step.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section id='reviews' className='mx-auto max-w-6xl px-5 py-20 md:py-24'>
                    <div className='flex flex-col gap-4 md:flex-row md:items-end md:justify-between'>
                        <div className='max-w-2xl'>
                            <p className='text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-400'>Reviews</p>
                            <h2 className='mt-3 text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl'>
                                People are getting more done
                            </h2>
                            <p className='mt-4 text-[14.5px] leading-relaxed text-slate-400'>
                                Feedback from developers, founders, and researchers testing the CortexAI preview.
                            </p>
                        </div>
                        <div className='flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3'>
                            <div className='flex -space-x-2'>
                                {reviews.slice(0, 3).map((review) => (
                                    <span key={review.name} className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#0d0f14] bg-gradient-to-br ${review.color} text-[9px] font-semibold text-white`}>
                                        {review.initials}
                                    </span>
                                ))}
                            </div>
                            <div>
                                <Stars />
                                <p className='mt-1 text-[10.5px] text-slate-500'>Rated 5/5 by preview users</p>
                            </div>
                        </div>
                    </div>

                    <div className='mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
                        {reviews.map((review) => (
                            <figure key={review.name} className='flex flex-col rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5'>
                                <Stars />
                                <blockquote className='mt-4 flex-1 text-[13px] leading-relaxed text-slate-300'>
                                    “{review.quote}”
                                </blockquote>
                                <figcaption className='mt-5 flex items-center gap-3 border-t border-white/[0.05] pt-4'>
                                    <span className={`flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br ${review.color} text-[11px] font-semibold text-white`}>
                                        {review.initials}
                                    </span>
                                    <div>
                                        <p className='text-[12.5px] font-medium text-slate-200'>{review.name}</p>
                                        <p className='text-[10.5px] text-slate-600'>{review.role}</p>
                                    </div>
                                </figcaption>
                            </figure>
                        ))}
                    </div>
                </section>

                <section className='mx-auto max-w-6xl px-5 pb-20'>
                    <div className='relative overflow-hidden rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/[0.12] via-violet-500/[0.07] to-[#0d0f14] px-6 py-12 text-center md:px-12 md:py-16'>
                        <div className='pointer-events-none absolute -top-32 left-1/2 h-64 w-[560px] -translate-x-1/2 rounded-full bg-indigo-500/20 blur-[100px]' />
                        <div className='relative'>
                            <span className='mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-indigo-500/25 bg-indigo-500/10 text-indigo-300'>
                                <Sparkles size={19} />
                            </span>
                            <h2 className='mx-auto mt-5 max-w-xl text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl'>
                                Stop juggling tools. Start one conversation.
                            </h2>
                            <p className='mx-auto mt-4 max-w-lg text-[14px] leading-relaxed text-slate-400'>
                                Bring your questions, documents, and ideas. CortexAI brings the agents,
                                the memory, and the finished artifacts.
                            </p>
                            <button
                                onClick={onLaunch}
                                className='group mx-auto mt-7 flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-[14px] font-semibold text-slate-900 transition-colors duration-150 hover:bg-slate-200'
                            >
                                {isLoggedIn ? 'Return to workspace' : 'Launch CortexAI'}
                                <ArrowRight size={16} className='transition-transform duration-150 group-hover:translate-x-0.5' />
                            </button>
                        </div>
                    </div>
                </section>
            </main>

            <footer className='border-t border-white/[0.06]'>
                <div className='mx-auto flex max-w-6xl flex-col gap-6 px-5 py-8 md:flex-row md:items-center md:justify-between'>
                    <div className='flex items-center gap-2.5'>
                        <span className='flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-700'>
                            <Sparkles size={14} />
                        </span>
                        <div>
                            <p className='text-[13px] font-semibold tracking-tight'>CortexAI</p>
                            <p className='text-[10.5px] text-slate-600'>Multi-agent AI workspace</p>
                        </div>
                    </div>
                    <div className='flex flex-wrap items-center gap-5 text-[11.5px] text-slate-500'>
                        <a href='#features' className='transition-colors hover:text-slate-200'>Features</a>
                        <a href='#how-it-works' className='transition-colors hover:text-slate-200'>How it works</a>
                        <a href='#reviews' className='transition-colors hover:text-slate-200'>Reviews</a>
                        <a href='#top' className='transition-colors hover:text-slate-200'>Back to top</a>
                    </div>
                    <p className='text-[10.5px] text-slate-600'>Built with React, FastAPI, LangGraph, LiteLLM, Qdrant, and Redis.</p>
                </div>
            </footer>
        </div>
    )
}

function PlusIcon() {
    return (
        <span className='flex h-5 w-5 items-center justify-center rounded-md bg-white/[0.05] text-slate-600'>
            <span className='text-[13px] leading-none'>+</span>
        </span>
    )
}

export default Landing
