/**
 * Built-in roadmap library.
 * These curated roadmaps power the platform with ZERO AI cost and are the
 * final fallback whenever every AI provider is unavailable. Admins can edit,
 * unpublish or add more from the admin panel. Resources favour free, reputable
 * sources (NPTEL/SWAYAM, freeCodeCamp, official docs, Microsoft/Google/AWS learn).
 */
const R = (title, url, type = 'course', free = true) => ({ title, url, type, free });
const S = (key, title, description, resources = [], isProject = false) => ({ key, title, description, resources, isProject });
const P = (title, duration, steps) => ({ title, duration, steps });

const NPTEL = R('NPTEL — free IIT/IISc courses', 'https://nptel.ac.in/courses');
const SWAYAM = R('SWAYAM — Govt. of India MOOCs', 'https://swayam.gov.in/');

const common = {
  communication: S('soft-comm', 'Communication & interview skills', 'Practise a 60-second self-introduction, STAR-format answers, and group discussions. Record yourself and improve.', [
    R('Google Interview Warmup', 'https://grow.google/certificates/interview-warmup/', 'practice'),
  ]),
};

export const ROADMAPS = [
  {
    slug: 'full-stack-web-development',
    title: 'Full Stack Web Development',
    category: 'Technology',
    icon: 'Code2',
    duration: '8–10 months',
    summary: 'Build and deploy complete web applications — from HTML/CSS to React, Node.js, databases and cloud deployment.',
    suitableFor: ['B.Tech', 'BCA', 'B.Sc', 'MCA', 'Diploma'],
    roles: ['Frontend Developer', 'Backend Developer', 'Full Stack Developer', 'Software Engineer'],
    skills: ['HTML', 'CSS', 'JavaScript', 'React', 'Node.js', 'Express', 'MongoDB', 'SQL', 'Git', 'REST APIs', 'Testing', 'Deployment'],
    keywords: ['web', 'web development', 'full stack', 'fullstack', 'mern', 'frontend', 'backend', 'react', 'node', 'javascript', 'software developer', 'website'],
    careerKit: [
      { key: 'github', label: 'GitHub profile with 3+ pinned, documented projects' },
      { key: 'codingProfile', label: 'Active LeetCode / HackerRank profile (100+ problems)' },
      { key: 'deployedProject', label: 'At least one live deployed project with a custom URL' },
    ],
    phases: [
      P('Web foundations', '6–8 weeks', [
        S('web-basics', 'How the web works, HTML & CSS', 'Semantic HTML, accessibility basics, CSS layout with Flexbox and Grid, responsive design.', [
          R('MDN Learn Web Development', 'https://developer.mozilla.org/en-US/docs/Learn', 'doc'),
          R('freeCodeCamp Responsive Web Design', 'https://www.freecodecamp.org/learn'),
        ]),
        S('js-core', 'JavaScript fundamentals', 'Variables, functions, arrays/objects, DOM, events, async/await, fetch, ES modules.', [
          R('javascript.info', 'https://javascript.info/', 'doc'),
          R('The Odin Project', 'https://www.theodinproject.com/'),
        ]),
        S('git', 'Git & GitHub', 'Commits, branches, pull requests, resolving conflicts, writing good READMEs.', [
          R('Pro Git book', 'https://git-scm.com/book/en/v2', 'book'),
          R('roadmap.sh — Git & GitHub', 'https://roadmap.sh/git-github', 'doc'),
        ]),
        S('proj-portfolio', 'Project: personal portfolio site', 'Build and deploy a responsive portfolio with your projects and resume.', [], true),
      ]),
      P('Frontend engineering', '8 weeks', [
        S('react', 'React fundamentals', 'Components, props, state, hooks, effects, forms, routing, data fetching.', [
          R('Official React docs (react.dev)', 'https://react.dev/learn', 'doc'),
        ]),
        S('state-styling', 'State management & styling', 'Context, a store library (Zustand/Redux), CSS modules or Tailwind, component libraries.', [
          R('roadmap.sh — React', 'https://roadmap.sh/react', 'doc'),
        ]),
        S('ts', 'TypeScript basics', 'Types, interfaces, generics — used by most product companies.', [
          R('TypeScript Handbook', 'https://www.typescriptlang.org/docs/handbook/intro.html', 'doc'),
        ]),
        S('proj-frontend', 'Project: React app consuming a public API', 'E.g. a movie or weather explorer with search, filters, loading and error states.', [], true),
      ]),
      P('Backend & databases', '8 weeks', [
        S('node-express', 'Node.js & Express', 'REST API design, middleware, validation, error handling, authentication with JWT.', [
          R('Node.js Learn', 'https://nodejs.org/en/learn', 'doc'),
          R('roadmap.sh — Backend', 'https://roadmap.sh/backend', 'doc'),
        ]),
        S('databases', 'Databases: MongoDB & SQL', 'Data modelling, indexing, aggregation; SQL joins and normalisation.', [
          R('MongoDB University (free)', 'https://learn.mongodb.com/'),
          R('SQLBolt interactive SQL', 'https://sqlbolt.com/', 'practice'),
        ]),
        S('security-basics', 'Web security basics', 'OWASP Top 10, password hashing, CORS, rate limiting, input validation.', [
          R('OWASP Top 10', 'https://owasp.org/www-project-top-ten/', 'doc'),
        ]),
        S('proj-fullstack', 'Project: full stack app with auth', 'E.g. a task manager or job tracker with login, CRUD, and role-based access.', [], true),
      ]),
      P('Industry readiness', '6 weeks', [
        S('testing-deploy', 'Testing, CI/CD & deployment', 'Unit/API tests, GitHub Actions, deploying to a VPS or cloud with HTTPS.', [
          R('GitHub Actions docs', 'https://docs.github.com/en/actions', 'doc'),
        ]),
        S('dsa', 'Data structures & algorithms for interviews', 'Arrays, strings, hashing, recursion, trees, graphs; 2–3 problems daily.', [
          R('NeetCode roadmap', 'https://neetcode.io/roadmap', 'practice'),
          R('LeetCode', 'https://leetcode.com/', 'practice'),
        ]),
        S('system-design-lite', 'Basics of system design', 'Caching, load balancing, databases at scale — enough for fresher interviews.', [
          R('System Design Primer', 'https://github.com/donnemartin/system-design-primer', 'doc'),
        ]),
        common.communication,
      ]),
    ],
  },
  {
    slug: 'data-science-ai',
    title: 'Data Science & AI/ML',
    category: 'Data & AI',
    icon: 'BrainCircuit',
    duration: '9–12 months',
    summary: 'Learn Python, statistics, machine learning and modern AI (LLMs) to build data-driven products.',
    suitableFor: ['B.Tech', 'B.Sc', 'BCA', 'M.Sc', 'M.Tech', 'MCA'],
    roles: ['Data Scientist', 'ML Engineer', 'AI Engineer', 'Research Assistant'],
    skills: ['Python', 'NumPy', 'Pandas', 'Statistics', 'Linear Algebra', 'Machine Learning', 'scikit-learn', 'Deep Learning', 'PyTorch', 'SQL', 'LLMs', 'MLOps'],
    keywords: ['data science', 'machine learning', 'ml', 'ai', 'artificial intelligence', 'deep learning', 'llm', 'genai', 'generative ai', 'nlp', 'computer vision', 'data scientist'],
    careerKit: [
      { key: 'github', label: 'GitHub with 3+ well-documented ML notebooks/projects' },
      { key: 'kaggle', label: 'Kaggle profile with at least 2 competition/dataset submissions' },
    ],
    phases: [
      P('Math & Python foundations', '8 weeks', [
        S('python', 'Python programming', 'Syntax, data structures, functions, OOP, virtual environments, Jupyter.', [
          R('Official Python tutorial', 'https://docs.python.org/3/tutorial/', 'doc'),
          R('Kaggle Learn — Python', 'https://www.kaggle.com/learn/python'),
        ]),
        S('math', 'Linear algebra, calculus & probability', 'Vectors, matrices, derivatives, distributions, Bayes theorem.', [
          R('3Blue1Brown — Essence of linear algebra', 'https://www.3blue1brown.com/topics/linear-algebra', 'video'),
          R('Khan Academy — Statistics & probability', 'https://www.khanacademy.org/math/statistics-probability'),
        ]),
        S('data-wrangling', 'NumPy, Pandas & visualisation', 'Cleaning, joining, grouping data; plotting with Matplotlib/Seaborn.', [
          R('Kaggle Learn — Pandas', 'https://www.kaggle.com/learn/pandas'),
        ]),
      ]),
      P('Machine learning', '10 weeks', [
        S('ml-core', 'Supervised & unsupervised learning', 'Regression, classification, trees, ensembles, clustering, evaluation metrics, cross-validation.', [
          R('Machine Learning Specialization (audit free)', 'https://www.coursera.org/specializations/machine-learning-introduction'),
          R('scikit-learn tutorials', 'https://scikit-learn.org/stable/tutorial/index.html', 'doc'),
        ]),
        S('sql-ds', 'SQL for data science', 'Joins, window functions, CTEs — asked in nearly every DS interview.', [
          R('SQLBolt', 'https://sqlbolt.com/', 'practice'),
        ]),
        S('proj-ml', 'Project: end-to-end ML model', 'Pick an Indian public dataset (data.gov.in), clean, model, evaluate and explain.', [
          R('Open Government Data India', 'https://data.gov.in/', 'tool'),
        ], true),
      ]),
      P('Deep learning & modern AI', '10 weeks', [
        S('dl', 'Neural networks & deep learning', 'Backpropagation, CNNs, RNNs, transformers; training with PyTorch.', [
          R('fast.ai Practical Deep Learning', 'https://course.fast.ai/'),
          R('PyTorch tutorials', 'https://pytorch.org/tutorials/', 'doc'),
        ]),
        S('llm', 'LLMs & generative AI', 'Prompting, embeddings, RAG, fine-tuning basics, evaluation and responsible AI.', [
          R('Hugging Face Learn', 'https://huggingface.co/learn'),
        ]),
        S('proj-ai', 'Project: AI application', 'E.g. a RAG chatbot over your college notes or a vision model, deployed as a demo.', [], true),
      ]),
      P('Industry readiness', '6 weeks', [
        S('mlops', 'MLOps basics', 'Experiment tracking, model serving with an API, Docker, monitoring.', [
          R('roadmap.sh — MLOps', 'https://roadmap.sh/mlops', 'doc'),
        ]),
        S('kaggle-comp', 'Compete & publish', 'Participate in a Kaggle competition; write a blog explaining a project.', [
          R('Kaggle competitions', 'https://www.kaggle.com/competitions', 'practice'),
        ]),
        common.communication,
      ]),
    ],
  },
  {
    slug: 'data-analytics',
    title: 'Data Analytics & Business Intelligence',
    category: 'Data & AI',
    icon: 'BarChart3',
    duration: '5–6 months',
    summary: 'Turn raw data into business decisions using Excel, SQL, Power BI/Tableau and storytelling.',
    suitableFor: ['Any graduate', 'B.Com', 'BBA', 'B.Sc', 'B.Tech', 'BA Economics'],
    roles: ['Data Analyst', 'Business Analyst', 'MIS Executive', 'BI Analyst'],
    skills: ['Excel', 'SQL', 'Power BI', 'Tableau', 'Statistics', 'Python', 'Data Visualisation', 'Storytelling'],
    keywords: ['data analyst', 'data analytics', 'analytics', 'business intelligence', 'bi', 'power bi', 'tableau', 'excel', 'mis', 'sql'],
    careerKit: [{ key: 'dashboardPortfolio', label: 'Portfolio of 3 dashboards (Power BI / Tableau Public)' }],
    phases: [
      P('Spreadsheets & statistics', '4 weeks', [
        S('excel', 'Advanced Excel', 'Lookups (XLOOKUP), pivot tables, charts, conditional formatting, data cleaning.', [
          R('Microsoft Excel help & learning', 'https://support.microsoft.com/en-us/excel', 'doc'),
        ]),
        S('stats', 'Descriptive statistics', 'Mean/median, variance, distributions, correlation, sampling, A/B testing basics.', [
          R('Khan Academy — Statistics', 'https://www.khanacademy.org/math/statistics-probability'),
        ]),
      ]),
      P('SQL & data modelling', '5 weeks', [
        S('sql', 'SQL querying', 'SELECT, joins, GROUP BY, subqueries, window functions.', [
          R('SQLBolt', 'https://sqlbolt.com/', 'practice'),
          R('W3Schools SQL', 'https://www.w3schools.com/sql/', 'doc'),
        ]),
        S('modelling', 'Data modelling', 'Star schema, fact/dimension tables, data quality checks.', [
          R('roadmap.sh — Data Analyst', 'https://roadmap.sh/data-analyst', 'doc'),
        ]),
      ]),
      P('Visualisation & BI tools', '6 weeks', [
        S('powerbi', 'Power BI', 'Power Query, DAX basics, interactive reports.', [
          R('Microsoft Learn — Power BI', 'https://learn.microsoft.com/en-us/training/powerplatform/power-bi', 'course'),
        ]),
        S('tableau', 'Tableau Public', 'Build and publish dashboards to your public profile.', [
          R('Tableau Public', 'https://public.tableau.com/', 'tool'),
        ]),
        S('proj-dashboard', 'Project: business dashboard', 'Sales/HR/finance dashboard from a public dataset with insights & recommendations.', [], true),
      ]),
      P('Industry readiness', '4 weeks', [
        S('python-analysis', 'Python for analysis (optional edge)', 'Pandas for automation of repetitive Excel work.', [
          R('Kaggle Learn — Pandas', 'https://www.kaggle.com/learn/pandas'),
        ]),
        S('case-studies', 'Business case studies', 'Practise guesstimates and case questions asked in analyst interviews.', []),
        common.communication,
      ]),
    ],
  },
  {
    slug: 'cloud-devops',
    title: 'Cloud Computing & DevOps',
    category: 'Technology',
    icon: 'Cloud',
    duration: '6–8 months',
    summary: 'Automate, deploy and run software reliably with Linux, Docker, Kubernetes, CI/CD and AWS/Azure.',
    suitableFor: ['B.Tech', 'BCA', 'MCA', 'B.Sc IT', 'Diploma'],
    roles: ['DevOps Engineer', 'Cloud Engineer', 'Site Reliability Engineer', 'System Administrator'],
    skills: ['Linux', 'Networking', 'Bash', 'Git', 'Docker', 'Kubernetes', 'CI/CD', 'AWS', 'Azure', 'Terraform', 'Monitoring'],
    keywords: ['devops', 'cloud', 'aws', 'azure', 'gcp', 'kubernetes', 'docker', 'sre', 'site reliability', 'linux', 'infrastructure'],
    careerKit: [{ key: 'cloudCert', label: 'Entry cloud certification (AWS Cloud Practitioner / AZ-900)' }],
    phases: [
      P('Systems foundations', '6 weeks', [
        S('linux', 'Linux & shell scripting', 'File system, permissions, processes, systemd, bash scripting.', [
          R('The Linux Command Line (free book)', 'https://linuxcommand.org/tlcl.php', 'book'),
        ]),
        S('networking', 'Networking basics', 'TCP/IP, DNS, HTTP(S), load balancers, firewalls.', [
          R('Cisco Networking Academy', 'https://www.netacad.com/'),
        ]),
      ]),
      P('Containers & automation', '8 weeks', [
        S('docker', 'Docker', 'Images, containers, volumes, multi-stage builds, compose.', [
          R('Docker Get Started', 'https://docs.docker.com/get-started/', 'doc'),
        ]),
        S('cicd', 'CI/CD pipelines', 'GitHub Actions/Jenkins: build, test, deploy automatically.', [
          R('GitHub Actions docs', 'https://docs.github.com/en/actions', 'doc'),
        ]),
        S('k8s', 'Kubernetes', 'Pods, deployments, services, ingress, config & secrets.', [
          R('Kubernetes tutorials', 'https://kubernetes.io/docs/tutorials/', 'doc'),
        ]),
      ]),
      P('Cloud platforms', '8 weeks', [
        S('aws', 'AWS or Azure fundamentals', 'Compute, storage, IAM, VPC, managed databases, cost management.', [
          R('AWS Skill Builder', 'https://skillbuilder.aws/'),
          R('Microsoft Learn — Azure', 'https://learn.microsoft.com/en-us/training/azure/'),
        ]),
        S('iac', 'Infrastructure as Code', 'Terraform basics to provision cloud resources reproducibly.', [
          R('Terraform tutorials', 'https://developer.hashicorp.com/terraform/tutorials', 'doc'),
        ]),
        S('proj-pipeline', 'Project: automated deployment pipeline', 'Containerise an app and deploy it to the cloud through CI/CD with monitoring.', [], true),
      ]),
      P('Industry readiness', '4 weeks', [
        S('observability', 'Monitoring & incident response', 'Logs, metrics, alerts (Prometheus/Grafana), post-mortems.', [
          R('roadmap.sh — DevOps', 'https://roadmap.sh/devops', 'doc'),
        ]),
        common.communication,
      ]),
    ],
  },
  {
    slug: 'cybersecurity',
    title: 'Cybersecurity',
    category: 'Technology',
    icon: 'ShieldCheck',
    duration: '8–10 months',
    summary: 'Protect systems and data — networking, Linux, web security, SOC operations and ethical hacking.',
    suitableFor: ['B.Tech', 'BCA', 'B.Sc', 'MCA', 'Diploma'],
    roles: ['SOC Analyst', 'Security Analyst', 'Penetration Tester (junior)', 'VAPT Engineer'],
    skills: ['Networking', 'Linux', 'Python', 'Web Security', 'OWASP', 'SIEM', 'Incident Response', 'Cryptography', 'Ethical Hacking'],
    keywords: ['cyber', 'cybersecurity', 'security', 'ethical hacking', 'hacking', 'soc', 'penetration testing', 'vapt', 'infosec'],
    careerKit: [
      { key: 'ctf', label: 'Completed 10+ rooms/labs on TryHackMe or PortSwigger Academy' },
      { key: 'secCert', label: 'Entry certification (e.g. CompTIA Security+ or ISC2 CC)' },
    ],
    phases: [
      P('Foundations', '8 weeks', [
        S('net-sec', 'Networking & OS fundamentals', 'OSI/TCP-IP, ports, Wireshark, Linux & Windows internals.', [
          R('Cisco Networking Academy', 'https://www.netacad.com/'),
          R('The Linux Command Line', 'https://linuxcommand.org/tlcl.php', 'book'),
        ]),
        S('py-sec', 'Python scripting for security', 'Automate scans, parse logs, small tools.', [
          R('Official Python tutorial', 'https://docs.python.org/3/tutorial/', 'doc'),
        ]),
      ]),
      P('Core security', '10 weeks', [
        S('websec', 'Web application security', 'OWASP Top 10, Burp Suite, SQLi, XSS, auth flaws — in legal labs only.', [
          R('PortSwigger Web Security Academy', 'https://portswigger.net/web-security', 'practice'),
          R('OWASP Top 10', 'https://owasp.org/www-project-top-ten/', 'doc'),
        ]),
        S('hands-on', 'Hands-on labs', 'Guided rooms on networking, Linux privilege escalation and blue-team topics.', [
          R('TryHackMe', 'https://tryhackme.com/', 'practice'),
        ]),
        S('crypto', 'Cryptography basics', 'Hashing, symmetric/asymmetric encryption, TLS, PKI.', [NPTEL]),
      ]),
      P('Defensive operations', '6 weeks', [
        S('soc', 'SOC & incident response', 'SIEM, log analysis, threat intelligence, MITRE ATT&CK.', [
          R('MITRE ATT&CK', 'https://attack.mitre.org/', 'doc'),
        ]),
        S('proj-sec', 'Project: home security lab', 'Set up a lab, simulate attacks, detect them, and write a report.', [], true),
      ]),
      P('Industry readiness', '4 weeks', [
        S('law', 'Cyber law & ethics', 'IT Act 2000, DPDP Act 2023, responsible disclosure, CERT-In guidelines.', [
          R('CERT-In', 'https://www.cert-in.org.in/', 'doc'),
        ]),
        common.communication,
      ]),
    ],
  },
  {
    slug: 'mobile-app-development',
    title: 'Mobile App Development',
    category: 'Technology',
    icon: 'Smartphone',
    duration: '6–8 months',
    summary: 'Build Android and cross-platform apps with Kotlin or Flutter and publish them to the Play Store.',
    suitableFor: ['B.Tech', 'BCA', 'MCA', 'B.Sc', 'Diploma'],
    roles: ['Android Developer', 'Flutter Developer', 'Mobile Engineer'],
    skills: ['Kotlin', 'Jetpack Compose', 'Dart', 'Flutter', 'REST APIs', 'Firebase', 'Git', 'App Publishing'],
    keywords: ['android', 'mobile', 'app development', 'flutter', 'kotlin', 'ios', 'react native', 'app'],
    careerKit: [{ key: 'playstore', label: 'One app published on Play Store (or a public APK + demo video)' }],
    phases: [
      P('Programming foundations', '6 weeks', [
        S('lang', 'Kotlin or Dart', 'Pick one path: Kotlin (native Android) or Dart (Flutter).', [
          R('Kotlin docs', 'https://kotlinlang.org/docs/home.html', 'doc'),
          R('Dart language tour', 'https://dart.dev/language', 'doc'),
        ]),
        S('git-m', 'Git & GitHub', 'Version control for every project.', [R('Pro Git book', 'https://git-scm.com/book/en/v2', 'book')]),
      ]),
      P('App development', '10 weeks', [
        S('android', 'Android with Jetpack Compose', 'UI, navigation, state, ViewModel, Room database.', [
          R('Android Developers courses', 'https://developer.android.com/courses'),
        ]),
        S('flutter', 'Flutter (cross-platform)', 'Widgets, layouts, state management, packages.', [
          R('Flutter docs', 'https://docs.flutter.dev/', 'doc'),
        ]),
        S('backend-m', 'APIs & Firebase', 'Networking, auth, Firestore, push notifications.', [
          R('Firebase docs', 'https://firebase.google.com/docs', 'doc'),
        ]),
        S('proj-app', 'Project: production-style app', 'E.g. expense tracker or campus events app with auth and offline support.', [], true),
      ]),
      P('Industry readiness', '4 weeks', [
        S('publish', 'Testing & publishing', 'Unit/UI tests, app signing, Play Console release.', [
          R('Play Console Help', 'https://support.google.com/googleplay/android-developer', 'doc'),
        ]),
        S('dsa-m', 'DSA for interviews', 'Core data structures; 2 problems daily.', [R('NeetCode roadmap', 'https://neetcode.io/roadmap', 'practice')]),
        common.communication,
      ]),
    ],
  },
  {
    slug: 'ui-ux-design',
    title: 'UI/UX Design',
    category: 'Design',
    icon: 'PenTool',
    duration: '5–7 months',
    summary: 'Design intuitive digital products — user research, wireframes, visual design and prototyping in Figma.',
    suitableFor: ['Any graduate', 'B.Des', 'B.Tech', 'BCA', 'BFA', 'BA'],
    roles: ['UI Designer', 'UX Designer', 'Product Designer', 'UX Researcher'],
    skills: ['User Research', 'Wireframing', 'Figma', 'Prototyping', 'Visual Design', 'Typography', 'Design Systems', 'Usability Testing', 'Accessibility'],
    keywords: ['ui', 'ux', 'design', 'ui/ux', 'product design', 'figma', 'user experience', 'graphic design', 'designer'],
    careerKit: [
      { key: 'designPortfolio', label: 'Portfolio with 3 case studies (Behance / personal site)' },
    ],
    phases: [
      P('Design foundations', '5 weeks', [
        S('principles', 'Design principles', 'Hierarchy, contrast, spacing, colour theory, typography, Gestalt.', [
          R('Laws of UX', 'https://lawsofux.com/', 'doc'),
        ]),
        S('ux-process', 'UX process & research', 'Personas, interviews, journey maps, information architecture.', [
          R('Nielsen Norman Group articles', 'https://www.nngroup.com/articles/', 'doc'),
        ]),
      ]),
      P('Tools & craft', '8 weeks', [
        S('figma', 'Figma', 'Frames, auto layout, components, variants, prototyping.', [
          R('Figma Help Center & tutorials', 'https://help.figma.com/', 'doc'),
        ]),
        S('a11y', 'Accessibility', 'WCAG basics, contrast, focus states, inclusive design.', [
          R('W3C WAI — Introduction to accessibility', 'https://www.w3.org/WAI/fundamentals/accessibility-intro/', 'doc'),
        ]),
        S('proj-redesign', 'Project: app redesign case study', 'Redesign a real Indian app flow, test with 5 users, document the process.', [], true),
      ]),
      P('Industry readiness', '5 weeks', [
        S('design-systems', 'Design systems & handoff', 'Tokens, components, documentation, developer handoff.', [
          R('roadmap.sh — UX Design', 'https://roadmap.sh/ux-design', 'doc'),
        ]),
        S('portfolio', 'Portfolio & case studies', 'Write 3 case studies: problem, research, iterations, outcome.', [
          R('Behance', 'https://www.behance.net/', 'community'),
        ]),
        common.communication,
      ]),
    ],
  },
  {
    slug: 'product-management',
    title: 'Product Management',
    category: 'Management',
    icon: 'Target',
    duration: '6 months',
    summary: 'Learn to discover user problems, prioritise, work with engineering & design, and measure product success.',
    suitableFor: ['B.Tech', 'MBA', 'BBA', 'Any graduate'],
    roles: ['Associate Product Manager', 'Product Analyst', 'Business Analyst'],
    skills: ['Product Thinking', 'User Research', 'Prioritisation', 'Metrics', 'SQL', 'Wireframing', 'Agile', 'Communication', 'Stakeholder Management'],
    keywords: ['product', 'product management', 'pm', 'apm', 'product manager', 'product analyst'],
    careerKit: [{ key: 'pmCaseStudy', label: '2 written product teardown / case studies' }],
    phases: [
      P('Product thinking', '6 weeks', [
        S('pm-basics', 'What product managers do', 'Problem discovery, outcomes vs outputs, product lifecycle.', [
          R('roadmap.sh — Product Manager', 'https://roadmap.sh/product-manager', 'doc'),
        ]),
        S('user-research', 'User research & UX basics', 'Interviews, surveys, personas, jobs-to-be-done.', [
          R('Nielsen Norman Group articles', 'https://www.nngroup.com/articles/', 'doc'),
        ]),
      ]),
      P('Execution skills', '8 weeks', [
        S('metrics', 'Metrics & analytics', 'North star metric, funnels, retention, A/B testing; basic SQL.', [
          R('SQLBolt', 'https://sqlbolt.com/', 'practice'),
        ]),
        S('agile', 'Agile & working with engineers', 'Scrum, user stories, PRDs, roadmaps, prioritisation (RICE, MoSCoW).', [
          R('Scrum Guide', 'https://scrumguides.org/', 'doc'),
        ]),
        S('proj-teardown', 'Project: product teardown + PRD', 'Analyse an app you use daily, find a problem, write a PRD with metrics.', [], true),
      ]),
      P('Industry readiness', '6 weeks', [
        S('pm-interviews', 'PM interview prep', 'Product sense, estimation, analytical and behavioural questions.', []),
        common.communication,
      ]),
    ],
  },
  {
    slug: 'digital-marketing',
    title: 'Digital Marketing',
    category: 'Management',
    icon: 'Megaphone',
    duration: '4–6 months',
    summary: 'Grow brands online through SEO, content, social media, performance ads and analytics.',
    suitableFor: ['Any graduate', 'BBA', 'B.Com', 'BA', 'BMS', 'MBA'],
    roles: ['Digital Marketing Executive', 'SEO Analyst', 'Social Media Manager', 'Performance Marketer'],
    skills: ['SEO', 'Content Marketing', 'Social Media', 'Google Ads', 'Meta Ads', 'Email Marketing', 'Google Analytics', 'Copywriting'],
    keywords: ['marketing', 'digital marketing', 'seo', 'social media', 'ads', 'performance marketing', 'content marketing', 'branding'],
    careerKit: [
      { key: 'marketingCerts', label: 'Google / HubSpot / Meta free certifications' },
      { key: 'campaignPortfolio', label: 'Portfolio: one real campaign with measurable results' },
    ],
    phases: [
      P('Marketing foundations', '4 weeks', [
        S('mkt-basics', 'Marketing fundamentals', '4Ps, customer journey, positioning, funnels.', [
          R('HubSpot Academy', 'https://academy.hubspot.com/'),
        ]),
        S('content', 'Content & copywriting', 'Writing for web, storytelling, content calendars.', [
          R('HubSpot Academy — Content Marketing', 'https://academy.hubspot.com/courses/content-marketing'),
        ]),
      ]),
      P('Channels', '8 weeks', [
        S('seo', 'SEO', 'Keyword research, on-page, technical SEO, link building.', [
          R('Google Search Central — SEO Starter Guide', 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide', 'doc'),
        ]),
        S('ads', 'Performance marketing', 'Google Ads, Meta Ads, budgeting, targeting, ROAS.', [
          R('Google Skillshop', 'https://skillshop.withgoogle.com/'),
          R('Meta Blueprint', 'https://www.facebook.com/business/learn'),
        ]),
        S('social', 'Social media & email', 'Platform strategy, community management, newsletters.', [
          R('Semrush Academy', 'https://www.semrush.com/academy/'),
        ]),
      ]),
      P('Analytics & readiness', '4 weeks', [
        S('ga', 'Web analytics', 'GA4 setup, events, conversions, reporting.', [R('Google Skillshop — Analytics', 'https://skillshop.withgoogle.com/')]),
        S('proj-campaign', 'Project: run a real campaign', 'Grow a page for a college club or local business; report results.', [], true),
        common.communication,
      ]),
    ],
  },
  {
    slug: 'human-resources',
    title: 'Human Resources (HR)',
    category: 'Management',
    icon: 'Users',
    duration: '5–6 months',
    summary: 'Build a career in talent acquisition, HR operations and people analytics.',
    suitableFor: ['BBA', 'MBA', 'BA Psychology', 'B.Com', 'Any graduate'],
    roles: ['HR Executive', 'Talent Acquisition Associate', 'HR Generalist', 'HR Operations Associate'],
    skills: ['Recruitment', 'Sourcing', 'Interviewing', 'Onboarding', 'Labour Laws', 'Payroll Basics', 'HRIS', 'Excel', 'Employee Engagement', 'Communication'],
    keywords: ['hr', 'human resources', 'recruitment', 'talent acquisition', 'people', 'hr generalist', 'recruiter', 'payroll'],
    careerKit: [{ key: 'hrCert', label: 'An HR-related certification (NPTEL / SHRM learning resources)' }],
    phases: [
      P('HR foundations', '5 weeks', [
        S('hrm', 'Human resource management basics', 'HR functions, organisational behaviour, HR policies.', [NPTEL, SWAYAM]),
        S('labour-law', 'Indian labour laws', 'The four Labour Codes, PF/ESI, Shops & Establishments, POSH Act basics.', [
          R('Ministry of Labour & Employment', 'https://labour.gov.in/', 'doc'),
        ]),
      ]),
      P('Core HR skills', '8 weeks', [
        S('ta', 'Talent acquisition', 'Job descriptions, sourcing on job portals/LinkedIn, screening, interviewing, offers.', [
          R('SHRM resources', 'https://www.shrm.org/topics-tools', 'doc'),
        ]),
        S('hr-ops', 'HR operations & payroll basics', 'Onboarding, attendance, payroll inputs, exits, HRIS tools.', []),
        S('excel-hr', 'Excel & HR analytics', 'Pivot tables, attrition analysis, HR dashboards.', [
          R('Microsoft Excel help & learning', 'https://support.microsoft.com/en-us/excel', 'doc'),
        ]),
        S('proj-hr', 'Project: hiring plan & HR dashboard', 'Create a hiring plan for a mock startup and an attrition dashboard.', [], true),
      ]),
      P('Industry readiness', '4 weeks', [
        S('engagement', 'Employee engagement & L&D', 'Engagement surveys, training needs analysis, performance reviews.', [
          R('CIPD resources', 'https://www.cipd.org/en/knowledge/', 'doc'),
        ]),
        common.communication,
      ]),
    ],
  },
  {
    slug: 'finance-accounting',
    title: 'Finance, Accounting & Banking',
    category: 'Commerce & Finance',
    icon: 'IndianRupee',
    duration: '6–8 months',
    summary: 'Prepare for roles in accounting, financial analysis, banking and investment research.',
    suitableFor: ['B.Com', 'BBA', 'BMS', 'BA Economics', 'MBA', 'Any graduate'],
    roles: ['Accounts Executive', 'Financial Analyst', 'Banking Associate', 'Equity Research Intern'],
    skills: ['Accounting', 'Tally', 'GST', 'Excel', 'Financial Modelling', 'Valuation', 'Financial Statements', 'Markets'],
    keywords: ['finance', 'accounting', 'banking', 'ca', 'cfa', 'commerce', 'financial analyst', 'investment', 'stock market', 'gst', 'tally'],
    careerKit: [{ key: 'finCert', label: 'NISM / financial modelling certification' }],
    phases: [
      P('Accounting foundations', '6 weeks', [
        S('acc', 'Financial accounting', 'Journal, ledger, trial balance, final accounts, accounting standards.', [NPTEL, SWAYAM]),
        S('tax', 'GST & income tax basics', 'GST registration, returns; TDS and income tax basics.', [
          R('GST portal tutorials', 'https://tutorial.gst.gov.in/', 'doc'),
        ]),
      ]),
      P('Analysis & markets', '10 weeks', [
        S('statements', 'Financial statement analysis', 'Balance sheet, P&L, cash flow, ratios.', [
          R('Zerodha Varsity', 'https://zerodha.com/varsity/'),
        ]),
        S('modelling', 'Excel financial modelling & valuation', 'Three-statement model, DCF, comparables.', [
          R('CFI free courses', 'https://corporatefinanceinstitute.com/collections/free-courses/'),
        ]),
        S('markets', 'Indian financial markets', 'Equity, debt, mutual funds, SEBI regulations.', [
          R('NISM', 'https://www.nism.ac.in/'),
        ]),
        S('proj-research', 'Project: equity research report', 'Analyse a listed Indian company and write a 5-page report.', [], true),
      ]),
      P('Industry readiness', '4 weeks', [
        S('banking-exams', 'Banking roles & exams (optional)', 'IBPS / SBI PO & clerk exam pattern awareness.', [R('IBPS', 'https://www.ibps.in/', 'doc')]),
        common.communication,
      ]),
    ],
  },
  {
    slug: 'business-analysis-consulting',
    title: 'Business Analysis & Consulting',
    category: 'Management',
    icon: 'Briefcase',
    duration: '5–6 months',
    summary: 'Solve business problems with structured thinking, data, process mapping and clear communication.',
    suitableFor: ['BBA', 'MBA', 'B.Tech', 'B.Com', 'Any graduate'],
    roles: ['Business Analyst', 'Associate Consultant', 'Operations Analyst', 'Strategy Analyst'],
    skills: ['Problem Solving', 'Excel', 'SQL', 'Process Mapping', 'Requirements Gathering', 'Presentation', 'Case Interviews', 'Power BI'],
    keywords: ['business analyst', 'consulting', 'consultant', 'strategy', 'operations', 'management consulting', 'mba'],
    careerKit: [{ key: 'caseDeck', label: 'One consulting-style slide deck solving a real case' }],
    phases: [
      P('Structured thinking', '5 weeks', [
        S('frameworks', 'Problem-solving frameworks', 'MECE, issue trees, hypothesis-driven thinking, root-cause analysis.', []),
        S('excel-ba', 'Excel & data basics', 'Pivot tables, lookups, charts, scenario analysis.', [
          R('Microsoft Excel help & learning', 'https://support.microsoft.com/en-us/excel', 'doc'),
        ]),
      ]),
      P('Analyst toolkit', '8 weeks', [
        S('requirements', 'Requirements & process mapping', 'BRD/FRD, user stories, BPMN, stakeholder interviews.', [
          R('IIBA resources', 'https://www.iiba.org/business-analysis-resources/', 'doc'),
        ]),
        S('sql-ba', 'SQL & dashboards', 'Querying data and presenting insights in Power BI.', [
          R('SQLBolt', 'https://sqlbolt.com/', 'practice'),
          R('Microsoft Learn — Power BI', 'https://learn.microsoft.com/en-us/training/powerplatform/power-bi'),
        ]),
        S('proj-case', 'Project: solve a business case', 'Pick a real Indian startup problem; analyse and present recommendations.', [], true),
      ]),
      P('Industry readiness', '4 weeks', [
        S('case-prep', 'Case interview practice', 'Guesstimates, profitability, market entry cases with a partner.', []),
        common.communication,
      ]),
    ],
  },
  {
    slug: 'mechanical-engineering-design',
    title: 'Mechanical Engineering & Design',
    category: 'Core Engineering',
    icon: 'Cog',
    duration: '8–10 months',
    summary: 'Become industry-ready in CAD/CAE, manufacturing, and core mechanical roles — or prepare for GATE/PSUs.',
    suitableFor: ['B.Tech Mechanical', 'Diploma Mechanical', 'B.E. Production', 'Automobile'],
    roles: ['Design Engineer', 'Production Engineer', 'Quality Engineer', 'CAE Analyst', 'Graduate Engineer Trainee'],
    skills: ['Engineering Drawing', 'AutoCAD', 'SolidWorks', 'CATIA', 'GD&T', 'FEA', 'Manufacturing Processes', 'Quality Tools', 'Lean'],
    keywords: ['mechanical', 'cad', 'cae', 'design engineer', 'manufacturing', 'automobile', 'production', 'solidworks', 'catia', 'ansys'],
    careerKit: [{ key: 'cadPortfolio', label: 'CAD portfolio (5+ models/drawings) on GrabCAD or PDF' }],
    phases: [
      P('Core fundamentals', '8 weeks', [
        S('core-mech', 'Revise core subjects', 'Strength of materials, thermodynamics, machine design, manufacturing.', [NPTEL]),
        S('drawing', 'Engineering drawing & GD&T', 'Orthographic projections, tolerances, GD&T symbols.', [NPTEL]),
      ]),
      P('Design tools', '10 weeks', [
        S('cad', 'CAD: AutoCAD & SolidWorks/Fusion', '2D drafting, part & assembly modelling, drawings.', [
          R('Autodesk Design & Make education', 'https://www.autodesk.com/education/edu-software/overview'),
          R('GrabCAD community', 'https://grabcad.com/', 'community'),
        ]),
        S('cae', 'CAE / FEA basics', 'Static structural analysis, meshing, interpreting results.', [NPTEL]),
        S('proj-mech', 'Project: design & analyse a component', 'Model, analyse and document a real component (e.g. bracket, gearbox).', [], true),
      ]),
      P('Industry practices', '6 weeks', [
        S('quality', 'Quality & lean manufacturing', '7 QC tools, Six Sigma basics, 5S, Kaizen.', [NPTEL]),
        S('gate', 'GATE / PSU preparation (optional)', 'Previous-year papers, mock tests, PSU recruitment via GATE.', [SWAYAM]),
        common.communication,
      ]),
    ],
  },
  {
    slug: 'civil-engineering',
    title: 'Civil Engineering & Construction',
    category: 'Core Engineering',
    icon: 'Building2',
    duration: '8–10 months',
    summary: 'Get site- and design-ready with structural analysis, AutoCAD/Revit, estimation and project management.',
    suitableFor: ['B.Tech Civil', 'Diploma Civil', 'B.Arch'],
    roles: ['Site Engineer', 'Structural Design Engineer', 'Quantity Surveyor', 'Planning Engineer', 'BIM Modeller'],
    skills: ['AutoCAD', 'Revit', 'STAAD.Pro', 'ETABS', 'Estimation', 'Quantity Surveying', 'Primavera', 'IS Codes', 'Site Management'],
    keywords: ['civil', 'construction', 'structural', 'site engineer', 'bim', 'revit', 'staad', 'quantity surveying', 'infrastructure'],
    careerKit: [{ key: 'bimPortfolio', label: 'Portfolio: drawings, BIM model and an estimation sheet' }],
    phases: [
      P('Core fundamentals', '8 weeks', [
        S('core-civil', 'Revise core subjects', 'Structural analysis, RCC design, geotechnical, surveying.', [NPTEL]),
        S('codes', 'Indian Standard codes', 'IS 456, IS 800, IS 875 — how codes are applied in design.', [
          R('Bureau of Indian Standards', 'https://www.bis.gov.in/', 'doc'),
        ]),
      ]),
      P('Software skills', '10 weeks', [
        S('cad-civil', 'AutoCAD & Revit (BIM)', 'Plans, sections, elevations, BIM modelling.', [
          R('Autodesk Design & Make education', 'https://www.autodesk.com/education/edu-software/overview'),
        ]),
        S('analysis', 'STAAD.Pro / ETABS', 'Modelling and analysing a G+3 building.', [
          R('Bentley STAAD', 'https://www.bentley.com/software/staad/', 'tool'),
        ]),
        S('proj-civil', 'Project: design a small building', 'Drawings, structural analysis and BOQ for a G+2 residence.', [], true),
      ]),
      P('Site & management', '6 weeks', [
        S('estimation', 'Estimation, costing & planning', 'BOQ, rate analysis, scheduling with MS Project/Primavera.', [NPTEL]),
        S('gate-civil', 'GATE / PSU preparation (optional)', 'Mock tests and previous papers.', [SWAYAM]),
        common.communication,
      ]),
    ],
  },
  {
    slug: 'electronics-embedded-vlsi',
    title: 'Electronics, Embedded Systems & VLSI',
    category: 'Core Engineering',
    icon: 'Cpu',
    duration: '8–10 months',
    summary: 'Design hardware: microcontrollers, embedded C, IoT, and VLSI design/verification for semiconductor jobs.',
    suitableFor: ['B.Tech ECE', 'B.Tech EEE', 'Diploma Electronics', 'M.Tech'],
    roles: ['Embedded Engineer', 'IoT Developer', 'VLSI Design/Verification Engineer', 'Hardware Engineer'],
    skills: ['Digital Electronics', 'C', 'Embedded C', 'Microcontrollers', 'RTOS', 'Verilog', 'SystemVerilog', 'PCB Design', 'IoT Protocols'],
    keywords: ['electronics', 'embedded', 'vlsi', 'iot', 'ece', 'eee', 'semiconductor', 'verilog', 'hardware', 'microcontroller', 'electrical'],
    careerKit: [{ key: 'hwProjects', label: '2 hardware projects with schematics, code and demo video' }],
    phases: [
      P('Core electronics', '8 weeks', [
        S('digital', 'Digital & analog electronics', 'Logic design, flip-flops, op-amps, basic circuits.', [NPTEL]),
        S('c-lang', 'C programming', 'Pointers, memory, bit manipulation, structures.', [
          R('Learn-C.org', 'https://www.learn-c.org/', 'practice'),
        ]),
      ]),
      P('Embedded & IoT', '10 weeks', [
        S('mcu', 'Microcontrollers', 'Arduino → STM32/ESP32: GPIO, timers, interrupts, UART/I2C/SPI.', [
          R('Arduino documentation', 'https://docs.arduino.cc/', 'doc'),
        ]),
        S('rtos', 'RTOS & embedded Linux basics', 'Tasks, scheduling, FreeRTOS; Raspberry Pi.', [
          R('FreeRTOS docs', 'https://www.freertos.org/Documentation/00-Overview', 'doc'),
          R('Raspberry Pi documentation', 'https://www.raspberrypi.com/documentation/', 'doc'),
        ]),
        S('proj-iot', 'Project: IoT system', 'E.g. smart energy meter with sensor, cloud dashboard and alerts.', [], true),
      ]),
      P('VLSI track (optional)', '8 weeks', [
        S('hdl', 'Verilog / SystemVerilog', 'RTL design, testbenches, simulation.', [
          R('ChipVerify tutorials', 'https://www.chipverify.com/', 'doc'),
          NPTEL,
        ]),
        S('vlsi-flow', 'VLSI design flow', 'Synthesis, STA, physical design overview; India Semiconductor Mission context.', [NPTEL]),
        common.communication,
      ]),
    ],
  },
  {
    slug: 'content-technical-writing',
    title: 'Content & Technical Writing',
    category: 'Creative & Media',
    icon: 'PenLine',
    duration: '4–5 months',
    summary: 'Write clear, engaging content — blogs, documentation, UX copy and marketing material.',
    suitableFor: ['BA', 'BA English', 'Mass Communication', 'Any graduate', 'B.Tech'],
    roles: ['Content Writer', 'Technical Writer', 'Copywriter', 'Content Strategist'],
    skills: ['Writing', 'Editing', 'SEO Writing', 'Research', 'Technical Documentation', 'Markdown', 'Content Strategy'],
    keywords: ['content', 'writing', 'writer', 'technical writing', 'copywriting', 'journalism', 'blogging', 'documentation'],
    careerKit: [{ key: 'writingPortfolio', label: 'Writing portfolio with 6+ published samples' }],
    phases: [
      P('Writing craft', '5 weeks', [
        S('grammar', 'Grammar, clarity & style', 'Plain language, structure, active voice, editing your own drafts.', [
          R('Google Technical Writing courses', 'https://developers.google.com/tech-writing', 'course'),
        ]),
        S('research', 'Research & fact-checking', 'Credible sources, citations, avoiding plagiarism.', []),
      ]),
      P('Specialise', '6 weeks', [
        S('seo-writing', 'SEO & web content', 'Search intent, headings, meta descriptions.', [
          R('Google SEO Starter Guide', 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide', 'doc'),
        ]),
        S('tech-docs', 'Technical documentation', 'API docs, how-to guides, docs-as-code with Markdown & Git.', [
          R('roadmap.sh — Technical Writer', 'https://roadmap.sh/technical-writer', 'doc'),
        ]),
        S('proj-writing', 'Project: publish a blog series', 'Publish 6 articles on Medium/Hashnode/your site in one niche.', [], true),
      ]),
      P('Industry readiness', '3 weeks', [
        S('freelance', 'Freelancing & client work', 'Briefs, pricing, revisions, contracts.', []),
        common.communication,
      ]),
    ],
  },
  {
    slug: 'government-public-sector',
    title: 'Government & Public Sector Careers',
    category: 'Public Sector',
    icon: 'Landmark',
    duration: '12+ months',
    summary: 'Plan for UPSC, SSC, banking, state PSC and PSU recruitment with a structured study approach.',
    suitableFor: ['Any graduate'],
    roles: ['Civil Services', 'SSC CGL posts', 'Bank PO / Clerk', 'PSU Engineer (via GATE)', 'State PSC posts'],
    skills: ['Quantitative Aptitude', 'Reasoning', 'English', 'General Studies', 'Current Affairs', 'Essay Writing', 'Time Management'],
    keywords: ['upsc', 'ias', 'government', 'govt job', 'ssc', 'bank po', 'ibps', 'psu', 'civil services', 'public sector', 'sarkari'],
    careerKit: [{ key: 'studyPlan', label: 'Written 6-month study plan with weekly mock tests' }],
    phases: [
      P('Understand the exams', '2 weeks', [
        S('exam-choice', 'Choose your exam(s)', 'Read official notifications: eligibility, pattern, syllabus, calendar.', [
          R('UPSC', 'https://upsc.gov.in/', 'doc'),
          R('SSC', 'https://ssc.gov.in/', 'doc'),
          R('IBPS', 'https://www.ibps.in/', 'doc'),
        ]),
      ]),
      P('Foundation', '16 weeks', [
        S('aptitude', 'Quantitative aptitude & reasoning', 'Arithmetic, data interpretation, logical reasoning — daily practice.', []),
        S('gs', 'General studies & NCERTs', 'History, polity, geography, economy from NCERT books.', [
          R('NCERT textbooks (official)', 'https://ncert.nic.in/textbook.php', 'book'),
        ]),
        S('current', 'Current affairs', 'Daily newspaper reading and monthly compilations; PIB releases.', [
          R('Press Information Bureau', 'https://pib.gov.in/', 'doc'),
        ]),
      ]),
      P('Practice & revision', 'Ongoing', [
        S('mocks', 'Mock tests & PYQs', 'Weekly full-length mocks; analyse mistakes.', []),
        S('answer-writing', 'Answer & essay writing (UPSC/PSC)', 'Daily answer writing practice with feedback.', []),
        S('wellbeing-gov', 'Sustainable routine', 'Long preparation needs breaks, exercise and a plan B career in parallel.', []),
      ]),
    ],
  },
];
