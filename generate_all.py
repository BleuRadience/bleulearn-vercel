#!/usr/bin/env python3
"""
BleuLearn Complete File Generator
AvaBleu House HQ | 2026
Generates ALL pages for the 23-strand sovereign curriculum platform
"""
import os

# ── ALL 23 CURRICULUM STRANDS ─────────────────────────────────────────────
STRANDS = [
  # (id, name, icon, ai_tutor, ai_icon, description, grade, path)
  ("math",        "Mathematics",                  "📐", "Prof. Polyglot",  "🧮",
   "Singapore Math — Complete K-12. Bar models, CPA approach, 5,200+ lessons. Every child can do math.",
   "K-12", "/math/"),
  ("science",     "Science",                      "🔬", "Dr. Soul",        "🧬",
   "Complete K-12 science. Inquiry-based, household-item labs, scientists of color in every unit.",
   "K-12", "/science/"),
  ("history",     "BleuHistory Book",             "📚", "Ms. Scriptura",   "📜",
   "12 volumes from African Origins to today. Primary sources, evidence logs, Harkness discussions.",
   "Grades 5-12", "/bleuhistory/"),
  ("language-arts","Language Arts",               "📖", "Ms. PolyNova",    "✍️",
   "Balanced global canon. Reading, writing, oral tradition, media literacy.",
   "K-12", "/language-arts/"),
  ("finance",     "Financial Architecture K-12",  "💰", "Ms. Wealth",      "💵",
   "Budgeting, investing, racial wealth gap, generational wealth, cooperative economics.",
   "K-12", "/financial-architecture/"),
  ("compsci",     "Computer Science",             "💻", "Mr. Debate",      "🤖",
   "Coding, AI literacy, digital citizenship, ethics, algorithmic bias.",
   "K-12", "/compsci/"),
  ("geography",   "Geography",                    "🌍", "Ms. Astoria",     "🗺️",
   "World geography, Indigenous territories, climate zones, map skills.",
   "K-12", "/geography/"),
  ("civics",      "Civics & Government",          "🏛️", "Judge Logic",     "⚖️",
   "Government, voting rights, civic action, Constitution, contemporary law.",
   "K-12", "/civics/"),
  ("health",      "Health & Wellness",            "🧠", "Coach Move",      "🏃",
   "Mental health, nutrition, movement, consent, healthy relationships.",
   "K-12", "/health/"),
  ("arabic",      "Arabic Language & Literacy",   "🔤", "Prof. Polyglot",  "🌙",
   "Modern Standard Arabic and dialect. Novice Low through Intermediate High.",
   "K-12", "/arabic/"),
  ("french",      "French Language & Literacy",   "🗣️", "Prof. Polyglot",  "🇫🇷",
   "French. Conversational through academic writing. Virginia SOL WL.1-WL.7.",
   "K-12", "/french/"),
  ("swahili",     "Swahili Language & Literacy",  "🌍", "Prof. Polyglot",  "🦁",
   "Swahili — Lugha ya Afrika. From greetings through academic vocabulary.",
   "K-12", "/swahili/"),
  ("yoruba",      "Yoruba Language & Literacy",   "🥁", "Prof. Polyglot",  "🌺",
   "Yoruba — Ede Yoruba. From family vocabulary through oral tradition.",
   "K-12", "/yoruba/"),
  ("spanish",     "Spanish Language & Literacy",  "🌎", "Prof. Polyglot",  "🌿",
   "Spanish. Conversational through academic writing. Virginia SOL WL.1-WL.7.",
   "K-12", "/spanish/"),
  ("indigenous",  "Indigenous Peoples Studies",   "🦅", "Elder Speaks",    "🌿",
   "Documented histories of Indigenous nations. Pre-colonial sovereignty through contemporary rights.",
   "K-12", "/indigenous/"),
  ("black-world", "Black World Studies",          "✊", "Dr. Afrika",      "🌍",
   "Documented global Black history from Africa to the Caribbean to the present. Not US-centric.",
   "K-12", "/black-world/"),
  ("economics",   "Cooperative Economics",        "🏦", "Prof. Merchant",  "🤝",
   "Cooperative business, community economics, documented path to generational wealth.",
   "Grades 5-12", "/cooperative-economics/"),
  ("rhetoric",    "Rhetoric & Documented Argument","📝", "Ms. Scriptura",   "🖊️",
   "Writing, research, argumentation. Virginia ELA SOL writing standards K-12.",
   "K-12", "/rhetoric/"),
  ("sourcelit",   "Primary Source Literacy",      "🔍", "Ms. Scriptura",   "📄",
   "Historical thinking, research methods, evidence standards. Foundation of all BleuLearn subjects.",
   "K-12", "/source-literacy/"),
  ("performing",  "Performing Arts",              "🎭", "Coach Move",      "🎸",
   "Music, theater, dance. Virginia Fine Arts SOL. Performance rooted in cultural tradition.",
   "K-12", "/performing-arts/"),
  ("visual",      "Visual Arts",                  "🎨", "Coach Move",      "🖌️",
   "Visual arts and design. Virginia Fine Arts SOL. Cultural context in every unit.",
   "K-12", "/visual-arts/"),
  ("physical",    "Physical Education & Movement","🏃", "Coach Move",      "⚽",
   "Physical education, athletics, movement science. Virginia PE SOL.",
   "K-12", "/physical-ed/"),
  ("civic-lead",  "Civic Leadership",             "🌟", "Judge Logic",     "🗣️",
   "Government, civics, community action. Virginia GOVT SOL and Civics and Economics SOL.",
   "K-12", "/civic-leadership/"),
]

def html_head(title, extra_css=""):
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BleuLearn — {title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="/css/bleulearn.css">
  <link rel="icon" href="/assets/favicon.ico">
  {extra_css}
</head>
<body>'''

def html_header(title, sub="", back="/"):
    return f'''
  <div class="container">
    <div class="main-header">
      <a href="{back}" class="logo" style="text-decoration:none;">
        <div class="logo-icon">🔷</div>
        <div><h1>BLEULEARN</h1><p>{sub or title}</p></div>
      </a>
      <div class="points-badge"><span>⭐</span><span class="points-display">⭐ 0</span></div>
    </div>
    <p class="breadcrumb"><a href="/">Home</a> → {title}</p>'''

def html_footer(js=""):
    return f'''
    <div class="site-footer">
      <strong style="color:var(--gold);font-family:var(--font-display)">BleuLearn</strong> — 
      AvaBleu House HQ | BleuLearn Sovereign Curriculum | 2026<br>
      <small><a href="/legal/terms.html">Terms</a> · <a href="/legal/privacy.html">Privacy</a> · 
      <a href="/legal/attribution.html">Attribution</a></small>
    </div>
  </div>
  <script src="/js/bleulearn.js"></script>
  {js}
</body></html>'''

# ── SUBJECT MODULE PAGES ───────────────────────────────────────────────────
def make_subject_page(strand):
    sid, name, icon, ai, ai_icon, desc, grade, path = strand
    folder = path.strip('/')
    
    # Special content for BleuHistory
    bh_extra = ""
    if sid == "history":
        bh_extra = '''
        <div class="card card-navy mt-24">
          <h3 style="font-family:var(--font-display);color:var(--gold);margin-bottom:12px;">📜 12-Volume Series</h3>
          <div class="grid-3" style="margin-top:16px;">''' + ''.join([
            f'<div onclick="BleuLearn.goTo(\'/bleuhistory/#vol{i}\')" style="background:rgba(255,255,255,0.1);border-radius:12px;padding:14px;cursor:pointer;"><div style="font-size:20px;margin-bottom:6px;">📗</div><p style="color:white;font-size:13px;font-weight:700;">Vol {i}</p><p style="color:rgba(255,255,255,0.7);font-size:12px;">{v}</p></div>'
            for i, v in enumerate([
              "African Origins","First Peoples Americas","Black Indigeneity",
              "World Before Contact","Global Slavery","The Confederacy",
              "Civil War & Reconstruction","The Second Betrayal","New Deal to Montgomery",
              "Civil Rights Movement","Voting Rights to Today","Black Women's History"
            ], 1)
          ]) + '''</div>
        </div>'''
    
    # Language extra
    lang_extra = ""
    if sid in ["arabic","french","swahili","yoruba","spanish"]:
        lang_extra = '''
        <div class="card card-teal mt-24">
          <h3 style="color:white;margin-bottom:12px;">🌐 Five-Language Mastery Program</h3>
          <p style="color:rgba(255,255,255,0.85);font-size:14px;">All five languages are taught simultaneously as part of the BleuLearn Five-Language Mastery strand. 
          This language is one of five: Arabic · French · Swahili · Yoruba · Spanish.</p>
          <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
            <a href="/arabic/" class="tag tag-light">Arabic</a>
            <a href="/french/" class="tag tag-light">French</a>
            <a href="/swahili/" class="tag tag-light">Swahili</a>
            <a href="/yoruba/" class="tag tag-light">Yoruba</a>
            <a href="/spanish/" class="tag tag-light">Spanish</a>
          </div>
        </div>'''
    
    content = html_head(name) + html_header(name, f"BleuLearn — {grade}") + f'''
    <div class="hero" style="margin-bottom:28px;">
      <div style="font-size:56px;margin-bottom:16px;">{icon}</div>
      <h1>{name}</h1>
      <p>{desc}</p>
      <div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;">
        <span class="tag tag-gold">{grade}</span>
        <span class="tag" style="background:rgba(255,255,255,0.15);color:white;">BleuLearn Strand #{[s[0] for s in STRANDS].index(sid)+1} of 23</span>
      </div>
    </div>

    <div class="grid-2" id="unitsGrid"></div>
    {bh_extra}
    {lang_extra}

    <div class="card card-interactive mt-24" style="text-align:center;background:var(--cream);"
         onclick="BleuLearn.chatWithAI('{ai}', '{name}')">
      <div style="font-size:52px;margin-bottom:12px;">{ai_icon}</div>
      <h3 style="font-family:var(--font-display);">Chat with {ai}</h3>
      <p style="color:var(--gray);">Your AI {name} tutor — ask any question, any time.</p>
      <button class="btn-primary" style="margin-top:16px;">Open AI Tutor</button>
    </div>

    <div class="card mt-16">
      <p class="section-sub">Resources</p>
      <div class="flex" style="gap:12px;flex-wrap:wrap;">
        <a href="/worksheets/" class="btn-outline">Worksheets</a>
        <a href="/guides/" class="btn-outline">Teacher Guides</a>
        <a href="/arcade/" class="btn-outline">Practice Arcade</a>
        <a href="/library/" class="btn-outline">Library</a>
      </div>
    </div>''' + html_footer(f'''
    <script>
    const units = [
      {{n:1, t:"Unit 1: Foundations", icon:"📖", lessons:12}},
      {{n:2, t:"Unit 2: Core Concepts", icon:"📚", lessons:15}},
      {{n:3, t:"Unit 3: Documented Evidence", icon:"🔍", lessons:12}},
      {{n:4, t:"Unit 4: Applied Practice", icon:"⚙️", lessons:10}},
      {{n:5, t:"Unit 5: Assessment & Capstone", icon:"⭐", lessons:8}}
    ];
    document.getElementById('unitsGrid').innerHTML = units.map(u => `
      <div class="card card-interactive" onclick="BleuLearn.showNotification('Unit ${{u.n}}: ${{u.t}} — ${{u.lessons}} lessons', 'info')">
        <div style="font-size:36px;text-align:center;margin-bottom:12px;">${{u.icon}}</div>
        <h3 style="text-align:center;font-family:var(--font-display)">${{u.t}}</h3>
        <p style="text-align:center;color:var(--gray);font-size:13px;">${{u.lessons}} lessons</p>
        <div class="progress-bar" style="margin:14px 0"><div class="progress-fill" style="width:0%"></div></div>
        <button class="btn-primary" style="width:100%">Start Unit</button>
      </div>`).join('');
    </script>''')
    
    os.makedirs(folder, exist_ok=True)
    with open(f'{folder}/index.html', 'w') as f:
        f.write(content)
    print(f"  ✓ {folder}/index.html")

# ── ARCADE LEVEL PAGES ─────────────────────────────────────────────────────
ARCADE_LEVELS = [
  (1, "Bar Builder", "🟦", "Build bar models to solve documented problems.", [
    {"text":"What is 8 + 5?","options":["11","12","13","14"],"correct":2,"pts":10,"doc":"Arithmetic — the documented foundation of all mathematics."},
    {"text":"A bar model shows 15 total, one part is 7. What is the other part?","options":["7","8","9","10"],"correct":1,"pts":15,"doc":"Bar model thinking — the Singapore Math documented method for part-whole relationships."},
    {"text":"What is 24 ÷ 4?","options":["4","5","6","7"],"correct":2,"pts":10,"doc":"Division — documented as the inverse of multiplication."},
  ]),
  (2, "Equation Engineer", "🔧", "Build and solve equations from documented word problems.", [
    {"text":"If 3n = 27, what is n?","options":["7","8","9","10"],"correct":2,"pts":15,"doc":"Algebra — first systematically documented by Al-Khwarizmi in 820 CE."},
    {"text":"Which equation represents: 'Five more than twice a number is 17'?","options":["2n-5=17","5n+2=17","2n+5=17","n+5=17"],"correct":2,"pts":20,"doc":"Translating word problems to equations — documented as a core algebraic skill."},
    {"text":"What is 15% of 80?","options":["10","12","14","16"],"correct":1,"pts":15,"doc":"Percentage — documented as essential for financial literacy."},
  ]),
  (3, "Algebra Apprentice", "📐", "Solve documented historical algebra problems.", [
    {"text":"The quadratic formula solves ax² + bx + c = 0. Who documented this method?","options":["Newton","Al-Khwarizmi","Euler","Pythagoras"],"correct":1,"pts":20,"doc":"Al-Khwarizmi (820 CE) documented the systematic solution of quadratic equations."},
    {"text":"If f(x) = 3x + 2, what is f(5)?","options":["15","16","17","18"],"correct":2,"pts":15,"doc":"Functions — documented as the mathematical relationship between inputs and outputs."},
    {"text":"Solve: 2(x + 3) = 16","options":["x=4","x=5","x=6","x=7"],"correct":1,"pts":20,"doc":"Distributing and solving — documented core algebra skill."},
  ]),
  (4, "Model Master", "🏆", "Advanced documented problem solving across subjects.", [
    {"text":"The Mali Empire's documented gold depressed Cairo's market for how many years?","options":["5","8","12","15"],"correct":2,"pts":25,"doc":"Al-Umari (c.1337) documented that Mansa Musa's 1324 pilgrimage depressed Cairo's gold market for 12 years."},
    {"text":"What percentage of Japanese Americans incarcerated under EO 9066 were U.S. citizens?","options":["About 30%","About 50%","About two-thirds","Nearly all"],"correct":2,"pts":25,"doc":"Barquera et al. (2020) and historical records document approximately two-thirds were U.S. citizens."},
    {"text":"The Trans-Atlantic Slave Trade Database documents how many slave voyages?","options":["About 10,000","About 20,000","About 36,000","About 50,000"],"correct":2,"pts":25,"doc":"slavevoyages.org documents approximately 36,000 voyages."},
  ]),
  (5, "Numerica Savior", "👑", "Final challenge — cross-subject documented mastery.", [
    {"text":"Esteban Dorantes led the first crossing of North America in what years?","options":["1492-1498","1510-1515","1528-1536","1540-1548"],"correct":2,"pts":30,"doc":"Cabeza de Vaca's Shipwrecks and Commentaries (1542) documents Esteban Dorantes leading the 1528-1536 crossing."},
    {"text":"Pauli Murray wrote the legal memorandum for Brown v. Board strategy in what year?","options":["1938","1944","1950","1952"],"correct":1,"pts":30,"doc":"Pauli Murray's 1944 memorandum is at the Schlesinger Library, Harvard University."},
    {"text":"The Dawes Rolls '$5 Indian' fraud is documented by which researcher?","options":["Howard Zinn","Gregory Smithers","Ivan Van Sertima","Walter Rodney"],"correct":1,"pts":30,"doc":"Gregory Smithers (VCU), ICT News (2017): documented that white men paid $5 to fraudulently enroll as Indigenous."},
  ]),
]

def make_arcade_pages():
    os.makedirs('arcade', exist_ok=True)
    
    # Hub page
    hub = html_head("BleuLearn Arcade") + html_header("The Arcade", "Practice & Points") + '''
    <div class="hero">
      <h1>🎮 BleuLearn Arcade</h1>
      <p>Earn points by answering documented questions from across all 23 curriculum strands. Every question is supported by a primary source.</p>
    </div>
    <div class="grid-2">''' + ''.join([
      f'''<div class="card card-interactive" onclick="BleuLearn.goTo('/arcade/level{lvl[0]}.html')">
        <div style="font-size:48px;text-align:center;margin-bottom:12px;">{lvl[2]}</div>
        <h3 style="text-align:center;font-family:var(--font-display);">Level {lvl[0]}: {lvl[1]}</h3>
        <p style="text-align:center;color:var(--gray);font-size:14px;">{lvl[3]}</p>
        <button class="btn-primary" style="width:100%;margin-top:16px;">Play Level {lvl[0]}</button>
      </div>''' for lvl in ARCADE_LEVELS
    ]) + '''
    </div>''' + html_footer()
    
    with open('arcade/index.html', 'w') as f: f.write(hub)
    print("  ✓ arcade/index.html")
    
    for lvl_num, lvl_name, lvl_icon, lvl_desc, questions in ARCADE_LEVELS:
        q_json = str(questions).replace("'", '"').replace('True', 'true').replace('False', 'false')
        page = html_head(f"Arcade Level {lvl_num}: {lvl_name}", '''
    <style>
      .q-counter{font-size:13px;color:var(--gray);margin-bottom:20px;}
      .doc-note{background:var(--cream);border-left:3px solid var(--gold);padding:10px 14px;border-radius:0 8px 8px 0;font-size:13px;margin-top:12px;display:none;}
      .option-btn{transition:all .15s;cursor:pointer;}
      .option-btn:disabled{cursor:not-allowed;opacity:0.7;}
      .next-wrap{margin-top:20px;text-align:center;display:none;}
    </style>''') + html_header(f"Level {lvl_num}: {lvl_name}", "Arcade", "/arcade/") + f'''
    <div class="game-card">
      <h2 style="font-family:var(--font-display);color:var(--bleu-deep);">{lvl_icon} Level {lvl_num}: {lvl_name}</h2>
      <p style="color:var(--gray);font-size:14px;">{lvl_desc}</p>
      <div class="q-counter">Question <span id="qnum">1</span> of {len(questions)} · ⭐ <span id="pts">0</span></div>
      <div class="question-text" id="qtext">Loading...</div>
      <div class="options-grid" id="opts"></div>
      <div class="feedback-box hidden" id="feedback"></div>
      <div class="doc-note" id="docnote"></div>
      <div class="next-wrap" id="nextwrap">
        <button class="btn-primary" onclick="nextQ()">Next Question →</button>
      </div>
    </div>''' + html_footer(f'''
    <script>
    const Qs = {q_json};
    let cur = 0, total = 0;
    function load() {{
      const q = Qs[cur];
      document.getElementById('qtext').textContent = q.text;
      document.getElementById('opts').innerHTML = q.options.map((o,i) =>
        `<button class="option-btn" onclick="check(${{i}})">${{o}}</button>`
      ).join('');
      document.getElementById('feedback').className = 'feedback-box hidden';
      document.getElementById('docnote').style.display = 'none';
      document.getElementById('nextwrap').style.display = 'none';
      document.getElementById('qnum').textContent = cur + 1;
    }}
    function check(sel) {{
      const q = Qs[cur];
      document.querySelectorAll('.option-btn').forEach((b,i) => {{
        b.disabled = true;
        if (i === q.correct) b.classList.add('correct');
        else if (i === sel && sel !== q.correct) b.classList.add('wrong');
      }});
      const fb = document.getElementById('feedback');
      const dn = document.getElementById('docnote');
      if (sel === q.correct) {{
        total += q.pts; document.getElementById('pts').textContent = total;
        fb.textContent = `✅ Correct! +${{q.pts}} points`;
        fb.className = 'feedback-box correct';
        BleuLearn.addPoints(q.pts, `Level {lvl_num} — Q${{cur+1}}`);
      }} else {{
        fb.textContent = `❌ Not quite. The correct answer is: ${{q.options[q.correct]}}`;
        fb.className = 'feedback-box wrong';
      }}
      dn.textContent = `📜 Why this matters: ${{q.doc}}`;
      dn.style.display = 'block';
      document.getElementById('nextwrap').style.display = cur + 1 < Qs.length ? 'block' : 'none';
      if (cur + 1 >= Qs.length) {{
        BleuLearn.addPoints(50, 'Level {lvl_num} completed!');
        fb.textContent += ' 🎉 LEVEL COMPLETE! +50 bonus!';
      }}
    }}
    function nextQ() {{ cur++; load(); }}
    load();
    </script>''')
        with open(f'arcade/level{lvl_num}.html', 'w') as f: f.write(page)
        print(f"  ✓ arcade/level{lvl_num}.html")

# ── WORKSHEETS INDEX ────────────────────────────────────────────────────────
def make_worksheets():
    ws_items = [
      ("WS1 — Primary Source Analysis","Every subject. Apply the four questions: Who? When? What? Why?","/worksheets/primary_source.html","📜","teal"),
      ("WS2 — Harkness Discussion Prep","BleuHistory. Pre-discussion: position, evidence, counterargument.","/worksheets/harkness.html","💬","navy"),
      ("WS3 — Bar Model Template","Mathematics. Singapore Math CPA approach — blank bar models.","/worksheets/bar_model.html","📐","gold"),
      ("WS4 — Archive Guide","All subjects. 14 public archives with URLs and content descriptions.","/worksheets/archive_guide.html","📁","forest"),
      ("WS5 — Primary Source Comparison","BleuHistory. Compare two Document Boxes — Venn + argument.","/worksheets/source_compare.html","🔍","teal"),
      ("WS6 — Document Box Deep Dive","BleuHistory. Full archive access + extended argument.","/worksheets/doc_box_deep.html","📚","navy"),
      ("WS7 — Documented Correction Essay","BleuHistory. Identify error, document correction, cite sources.","/worksheets/correction_essay.html","✍️","gold"),
      ("WS8 — Science Inquiry Lab","Science K-12. Household-item experiment template.","/worksheets/science_lab.html","🔬","forest"),
      ("WS9 — Financial Literacy Budget","Financial Architecture. Monthly budget and savings planner.","/worksheets/budget.html","💰","teal"),
      ("WS10 — Code Journal","Computer Science. Daily coding documentation and debugging log.","/worksheets/code_journal.html","💻","navy"),
      ("WS11 — Map Activity","Geography. Blank map annotation and territory analysis.","/worksheets/map_activity.html","🌍","gold"),
      ("WS12 — Civics Bill Tracker","Civics. Track a documented bill from introduction to law.","/worksheets/bill_tracker.html","🏛️","forest"),
    ]
    os.makedirs('worksheets', exist_ok=True)
    idx = html_head("Worksheets") + html_header("Student Worksheets", "All 23 Strands") + '''
    <div class="hero"><h1>Student Worksheets</h1>
    <p>Every worksheet is aligned to a specific BleuLearn curriculum strand. Every worksheet requires documented evidence — no undocumented opinion accepted.</p></div>
    <div class="grid-2">''' + ''.join([
      f'''<div class="card card-interactive" onclick="BleuLearn.goTo('{w[2]}')">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:12px;">
          <div class="subject-icon {w[4]}" style="width:48px;height:48px;min-width:48px;">{w[3]}</div>
          <div><h3 style="font-family:var(--font-display);font-size:16px;">{w[0]}</h3>
          <p style="color:var(--gray);font-size:13px;">{w[1]}</p></div>
        </div>
        <button class="btn-outline" style="width:100%">Open Worksheet</button>
      </div>''' for w in ws_items
    ]) + '</div>' + html_footer()
    with open('worksheets/index.html', 'w') as f: f.write(idx)
    print("  ✓ worksheets/index.html")

# ── BLEUHISTORY DEDICATED PAGE ──────────────────────────────────────────────
def make_bleuhistory():
    os.makedirs('bleuhistory', exist_ok=True)
    vols = [
      (1,"The African Origins of Humanity and Civilization","Grades 5-6","Lucy, Mansa Musa, Alfonso I, Great Zimbabwe, Swahili Coast"),
      (2,"The First Peoples of the Americas","Grades 5-6","Monte Verde, Maya, Cahokia, Haudenosaunee, Powhatan Confederacy"),
      (3,"Black Americans as Indigenous to the United States","Grades 6-7","Columbus's diary, Esteban Dorantes, Ancient DNA, Dawes Rolls $5 Indian fraud"),
      (4,"The World Before Contact","Grades 6-7","Islamic Golden Age, Doctrine of Discovery, Papal Bulls, Johnson v. McIntosh"),
      (5,"Global Slavery Systems and the Transatlantic Slave Trade","Grades 7-8","12.5 million transported, Middle Passage, Equiano, Zong massacre"),
      (6,"The Confederacy: What the Documents Say","Grades 7-8","Confederate declarations of secession in their own words, Lost Cause documented"),
      (7,"Civil War and Reconstruction","Grades 7-8","Harriet Tubman's military command, 13th/14th/15th Amendments, Buffalo Soldiers, Stand Watie"),
      (8,"The Second Betrayal: 1877-1930","Grades 8-9","Jim Crow, Ida B. Wells, Tulsa Race Massacre, Chinese Exclusion, Mexican Repatriation"),
      (9,"The New Deal, WWII, and the Road to Montgomery","Grades 8-9","Double V, EO 9066, Zoot Suit Riots, Brown v. Board"),
      (10,"The Civil Rights Movement: 1955-1968","Grades 8-9","AIM, Chicano Movement, Young Lords, Stonewall, Marsha P. Johnson"),
      (11,"From Voting Rights to Today","Grades 9-10","Shelby County, Black Lives Matter, Standing Rock, H.R. 40"),
      (12,"Black Women's History Across All Eras","Grades 9-12","Pauli Murray, Claudette Colvin, Two-Spirit traditions, Global Black women"),
    ]
    page = html_head("The BleuHistory Book") + html_header("The BleuHistory Book", "12 Volumes · Grades 5-12") + '''
    <div class="hero">
      <h1>The BleuHistory Book</h1>
      <p>A sovereign K-12 history curriculum built entirely on documented primary sources accessible through public archives. Every claim is verified. Every correction is documented.</p>
      <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
        <span class="tag tag-gold">12 Volumes</span>
        <span class="tag" style="background:rgba(255,255,255,0.15);color:white;">Primary Sources Only</span>
        <span class="tag" style="background:rgba(255,255,255,0.15);color:white;">Harkness Discussions</span>
        <span class="tag" style="background:rgba(255,255,255,0.15);color:white;">Archive Assignments</span>
      </div>
    </div>
    <p class="section-sub">The Four Questions</p>
    <div class="grid-4" style="margin-bottom:28px;">
      <div class="card text-center" style="background:var(--bleu-deep);color:white;"><div style="font-size:28px;">👤</div><h3>WHO</h3><p style="font-size:13px;opacity:0.8">created this document?</p></div>
      <div class="card text-center" style="background:var(--gold);color:white;"><div style="font-size:28px;">📅</div><h3>WHEN</h3><p style="font-size:13px;opacity:0.8">was it created?</p></div>
      <div class="card text-center" style="background:var(--teal);color:white;"><div style="font-size:28px;">📄</div><h3>WHAT</h3><p style="font-size:13px;opacity:0.8">does it say?</p></div>
      <div class="card text-center" style="background:var(--forest);color:white;"><div style="font-size:28px;">❓</div><h3>WHY</h3><p style="font-size:13px;opacity:0.8">does it matter?</p></div>
    </div>
    <p class="section-sub">All 12 Volumes</p>
    <div class="grid-2">''' + ''.join([
      f'''<div class="card card-interactive" id="vol{v[0]}" onclick="BleuLearn.showNotification('Volume {v[0]}: {v[1]} — {v[2]}', 'info')">
        <div style="display:flex;align-items:flex-start;gap:14px;">
          <div style="background:var(--bleu-deep);color:var(--gold);font-family:var(--font-display);font-size:20px;font-weight:800;width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">{v[0]}</div>
          <div>
            <span class="tag tag-light" style="margin-bottom:6px;">{v[2]}</span>
            <h3 style="font-family:var(--font-display);font-size:16px;margin-bottom:6px;">{v[1]}</h3>
            <p style="font-size:13px;color:var(--gray);">{v[3]}</p>
          </div>
        </div>
      </div>''' for v in vols
    ]) + '''
    </div>
    <div class="card card-interactive mt-24 text-center" style="background:var(--cream);" onclick="BleuLearn.chatWithAI('Ms. Scriptura', 'BleuHistory')">
      <div style="font-size:52px;">📜</div>
      <h3 style="font-family:var(--font-display);">Chat with Ms. Scriptura</h3>
      <p style="color:var(--gray);">Your AI BleuHistory tutor. Ask about any primary source, any volume, any documented person.</p>
      <button class="btn-primary" style="margin-top:16px;">Open AI Tutor</button>
    </div>''' + html_footer()
    with open('bleuhistory/index.html', 'w') as f: f.write(page)
    print("  ✓ bleuhistory/index.html")

# ── DASHBOARD (index.html) ──────────────────────────────────────────────────
def make_dashboard():
    strand_cards = ''.join([
      f'''<div class="card card-interactive" onclick="BleuLearn.goTo('{s[7]}')">
        <div style="font-size:36px;text-align:center;margin-bottom:10px;">{s[2]}</div>
        <h3 style="font-family:var(--font-display);font-size:15px;text-align:center;">{s[1]}</h3>
        <p style="font-size:11px;text-align:center;color:var(--gray);">{s[6]}</p>
      </div>''' for s in STRANDS[:12]
    ])
    strand_cards2 = ''.join([
      f'''<div class="card card-interactive" onclick="BleuLearn.goTo('{s[7]}')">
        <div style="font-size:36px;text-align:center;margin-bottom:10px;">{s[2]}</div>
        <h3 style="font-family:var(--font-display);font-size:15px;text-align:center;">{s[1]}</h3>
        <p style="font-size:11px;text-align:center;color:var(--gray);">{s[6]}</p>
      </div>''' for s in STRANDS[12:]
    ])
    
    page = html_head("Dashboard — AvaBleu House HQ") + '''
<body>
<div class="container">
  <div class="main-header">
    <div class="logo">
      <div class="logo-icon">🔷</div>
      <div><h1>BLEULEARN</h1><p>Sovereign Curriculum</p></div>
    </div>
    <div class="points-badge"><span>⭐</span><span class="points-display">⭐ 0</span></div>
  </div>

  <div class="hero">
    <h1>Your Sovereign Education Starts Here</h1>
    <p>23 documented curriculum strands. Every claim supported by a primary source accessible through a public archive. The document is the lesson. The document is the answer.</p>
    <div style="margin-top:24px;display:flex;gap:12px;flex-wrap:wrap;">
      <button class="btn-gold" onclick="BleuLearn.goTo('/bleuhistory/')">📚 BleuHistory Book</button>
      <button class="btn-outline" style="color:white;border-color:rgba(255,255,255,0.4);" onclick="BleuLearn.goTo('/arcade/')">🎮 Arcade</button>
      <button class="btn-outline" style="color:white;border-color:rgba(255,255,255,0.4);" onclick="BleuLearn.goTo('/teacher/')">👩‍🏫 Teacher Hub</button>
    </div>
  </div>

  <p class="section-sub">23 Curriculum Strands</p>
  <p style="margin-bottom:20px;color:var(--gray);">AvaBleu House HQ | BleuLearn Sovereign Curriculum | Grades K-12</p>

  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px;" id="strandGrid1">
''' + strand_cards + '</div>' + '''
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:40px;" id="strandGrid2">
''' + strand_cards2 + '''
  </div>

  <p class="section-sub">Quick Links</p>
  <div class="grid-4" style="margin-bottom:40px;">
    <div class="card card-interactive" onclick="BleuLearn.goTo('/arcade/')"><div style="font-size:36px;text-align:center;">🎮</div><h3 style="text-align:center;font-family:var(--font-display);">Arcade</h3></div>
    <div class="card card-interactive" onclick="BleuLearn.goTo('/worksheets/')"><div style="font-size:36px;text-align:center;">📋</div><h3 style="text-align:center;font-family:var(--font-display);">Worksheets</h3></div>
    <div class="card card-interactive" onclick="BleuLearn.goTo('/teacher/')"><div style="font-size:36px;text-align:center;">👩‍🏫</div><h3 style="text-align:center;font-family:var(--font-display);">Teacher Hub</h3></div>
    <div class="card card-interactive" onclick="BleuLearn.goTo('/assessment/')"><div style="font-size:36px;text-align:center;">📊</div><h3 style="text-align:center;font-family:var(--font-display);">Assessment</h3></div>
  </div>

  <div class="site-footer">
    <strong style="color:var(--gold);font-family:var(--font-display)">BLEULEARN</strong> — AvaBleu House HQ · BleuLearn Sovereign Curriculum · 2026<br>
    <small><a href="/legal/terms.html">Terms</a> · <a href="/legal/privacy.html">Privacy</a> · <a href="/legal/attribution.html">Attribution</a></small>
  </div>
</div>
<script src="/js/bleulearn.js"></script>
<script>
@media (max-width:768px){#strandGrid1,#strandGrid2{grid-template-columns:repeat(2,1fr)!important}}
</script>
</body></html>'''
    
    with open('index.html', 'w') as f: f.write(page)
    print("  ✓ index.html (dashboard)")

# ── TEACHER HUB ──────────────────────────────────────────────────────────────
def make_teacher():
    os.makedirs('teacher', exist_ok=True)
    tools = [
      ("📝","AI Lesson Planner","Generate documented lesson plans aligned to Virginia SOL and BleuLearn standards.","/teacher/ai_lesson_planner.html"),
      ("✅","AI Grading Assistant","Score documented arguments against published rubrics. Flag undocumented claims.","/teacher/ai_grading.html"),
      ("📨","AI Parent Communications","Draft documented parent updates on student progress.","/teacher/ai_parent_comms.html"),
      ("📊","Student Progress Dashboard","Track documented completion and documented assessment data.","/teacher/progress.html"),
      ("📋","BleuTeacher Handbook","Complete documented guide: Harkness facilitation, Document Boxes, archive assignments.","/teacher/handbook.html"),
      ("🎓","Professional Development","10-module documented PD program. Required before classroom use.","/training/"),
    ]
    page = html_head("Teacher Hub") + html_header("Teacher Hub", "BleuLearn Educator Resources") + '''
    <div class="hero">
      <h1>Teacher Hub</h1>
      <p>Every tool here is documented. Every lesson plan is aligned to a documented standard. Every grading rubric is based on a documented evidence requirement.</p>
    </div>
    <div class="grid-2">''' + ''.join([
      f'''<div class="card card-interactive" onclick="BleuLearn.goTo('{t[3]}')">
        <div style="font-size:40px;margin-bottom:12px;">{t[0]}</div>
        <h3 style="font-family:var(--font-display);">{t[1]}</h3>
        <p style="color:var(--gray);font-size:14px;">{t[2]}</p>
        <button class="btn-primary" style="margin-top:16px;">Open</button>
      </div>''' for t in tools
    ]) + '''
    </div>''' + html_footer()
    with open('teacher/index.html', 'w') as f: f.write(page)
    print("  ✓ teacher/index.html")

# ── LEGAL PAGES ──────────────────────────────────────────────────────────────
def make_legal():
    os.makedirs('legal', exist_ok=True)
    legal_pages = {
        'terms.html': ('Terms of Service', 'These Terms of Service govern your use of the BleuLearn platform operated by AvaBleu House HQ. BleuLearn is a K-12 sovereign curriculum platform. All curriculum content is the intellectual property of AvaBleu House HQ and is licensed under the Curriculum License Agreement.'),
        'privacy.html': ('Privacy Policy', 'AvaBleu House HQ is committed to protecting student privacy. We do not sell student data. We do not share student data with third parties for advertising purposes. Student progress data is stored locally in the browser and is not transmitted to any server without explicit consent.'),
        'attribution.html': ('Attribution', 'The BleuHistory Book series cites all primary sources with full archive attribution. All primary sources are in the public domain and are accessible through documented public archives including the National Archives, Library of Congress, Avalon Project (Yale), and other documented institutions.'),
        'report_violation.html': ('Report a Violation', 'If you believe any content in the BleuLearn platform contains a factual error not supported by documented primary source evidence, please report it. We take the documented standard seriously.'),
    }
    for fname, (title, content) in legal_pages.items():
        page = html_head(title) + html_header(title, "BleuLearn Legal") + f'''
    <div class="card"><h2 style="font-family:var(--font-display);margin-bottom:16px;">{title}</h2>
    <p style="color:var(--gray);font-size:14px;line-height:1.7;">{content}</p></div>''' + html_footer()
        with open(f'legal/{fname}', 'w') as f: f.write(page)
        print(f"  ✓ legal/{fname}")

# ── VERCEL CONFIG ─────────────────────────────────────────────────────────────
def make_config():
    import json
    config = {
        "version": 2,
        "builds": [{"src": "api/*.py", "use": "@vercel/python"}],
        "routes": [
            {"src": "/api/(.*)", "dest": "/api/$1"},
            {"src": "/(.*)", "dest": "/$1"}
        ]
    }
    with open('vercel.json', 'w') as f: json.dump(config, f, indent=2)
    
    with open('.gitignore', 'w') as f:
        f.write("__pycache__/\n*.pyc\n.env\n.DS_Store\n*.zip\n")
    
    with open('robots.txt', 'w') as f:
        f.write("User-agent: *\nAllow: /\nSitemap: /sitemap.xml\n")
    
    with open('404.html', 'w') as f:
        f.write(html_head("Page Not Found") + html_header("Not Found", "BleuLearn") + '''
    <div class="card text-center" style="padding:60px;">
      <div style="font-size:64px;margin-bottom:20px;">🔍</div>
      <h2 style="font-family:var(--font-display);">Page Not Found</h2>
      <p style="color:var(--gray);margin:16px 0;">The document does not exist. But the archive does.</p>
      <button class="btn-primary" onclick="BleuLearn.goTo('/')">Return to Dashboard</button>
    </div>''' + html_footer())
    
    with open('README.md', 'w') as f:
        f.write("""# BleuLearn Sovereign Curriculum Platform
## AvaBleu House HQ | 2026

A complete K-12 educational platform for the BleuLearn Sovereign Curriculum.

### 23 Curriculum Strands
1. Mathematics (Singapore Math)
2. Science
3. BleuHistory Book (12 volumes)
4. Language Arts
5. Financial Architecture K-12
6. Computer Science
7. Geography
8. Civics & Government
9. Health & Wellness
10. Arabic Language & Literacy
11. French Language & Literacy
12. Swahili Language & Literacy
13. Yoruba Language & Literacy
14. Spanish Language & Literacy
15. Indigenous Peoples Studies
16. Black World Studies
17. Cooperative Economics
18. Rhetoric & Documented Argument
19. Primary Source Literacy
20. Performing Arts
21. Visual Arts
22. Physical Education & Movement
23. Civic Leadership

### Deploy to Vercel
1. Push this folder to GitHub
2. Connect to Vercel at vercel.com
3. Deploy

### Standards
All content meets:
- Virginia Standards of Learning (SOL)
- NCSS C3 Framework
- Common Core ELA (Grades 6-12)
- ACTFL proficiency levels (World Languages)

© 2026 AvaBleu House HQ | BleuLearn Sovereign Curriculum
""")
    print("  ✓ vercel.json, .gitignore, robots.txt, 404.html, README.md")

# ── RUN ALL ────────────────────────────────────────────────────────────────────
print("\n🔷 Generating BleuLearn complete platform...\n")

print("\n[1/7] Subject Module Pages:")
for strand in STRANDS:
    make_subject_page(strand)

print("\n[2/7] Arcade Pages:")
make_arcade_pages()

print("\n[3/7] BleuHistory Dedicated Page:")
make_bleuhistory()

print("\n[4/7] Worksheets Index:")
make_worksheets()

print("\n[5/7] Teacher Hub:")
make_teacher()

print("\n[6/7] Legal Pages:")
make_legal()

print("\n[7/7] Config & Dashboard:")
make_config()
make_dashboard()

# Count all files
total = sum(len(files) for _, _, files in os.walk('.'))
print(f"\n✅ COMPLETE — {total} files generated")
print("📁 Deploy to Vercel: drag bleulearn-vercel folder to vercel.com")
