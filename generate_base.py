import os

dirs = [
    'css', 'js', 'api', 'assets', 'waitinglist',
    'math', 'science', 'history', 'language-arts', 'finance', 'compsci',
    'geography', 'civics', 'health', 'arcade', 'games', 'store', 'badges',
    'competitions', 'avatar', 'library', 'fieldtrips', 'inventions', 'portfolio',
    'assessment', 'bridge', 'gifted', 'ai_tutor', 'teacher', 'training',
    'admin', 'worksheets', 'guides', 'posters', 'printables', 'legal', 'capstone',
    # Missing from template -- our 23 strands require these:
    'indigenous', 'black-world', 'arabic', 'french', 'swahili', 'yoruba', 'spanish',
    'cooperative-economics', 'rhetoric', 'source-literacy', 'performing-arts',
    'visual-arts', 'physical-ed', 'civic-leadership', 'wellness',
    'bleuhistory', 'financial-architecture'
]
for d in dirs:
    os.makedirs(d, exist_ok=True)

print("Directories created:")
for d in dirs:
    print(f"  /{d}/")
print(f"\nTotal: {len(dirs)} directories")
