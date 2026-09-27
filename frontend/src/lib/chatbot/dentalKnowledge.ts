export interface DentalTopic {
  id: string;
  keywords: string[];
  answer: string;
  related?: string[];
}

export const SOFT_DISCLAIMER =
  "This is general guidance, not a diagnosis. For anything painful or persistent, see a dentist.";

export const SAFETY_DISCLAIMER =
  "Dr. Denta provides general education only and cannot diagnose conditions or replace an examination.";

export const EMERGENCY_KEYWORDS = [
  "knocked out",
  "knocked out tooth",
  "tooth fell out",
  "avulsed",
  "severe pain",
  "unbearable",
  "cant sleep",
  "can't sleep",
  "cannot sleep",
  "swelling",
  "swollen face",
  "swollen jaw",
  "face is swollen",
  "bleeding that wont stop",
  "wont stop bleeding",
  "heavy bleeding",
  "broken jaw",
  "trauma",
  "accident",
  "abscess",
  "pus",
  "fever",
  "difficulty swallowing",
  "difficulty breathing",
  "trouble breathing",
  "trouble swallowing",
  "dental emergency",
  "emergency dentist",
];

export const EMERGENCY_REPLY =
  "This may be a dental emergency. If you have severe pain, facial swelling, bleeding that will not stop, a knocked-out adult tooth, fever, or trouble breathing or swallowing, seek urgent care now.\n\n" +
  "For a knocked-out adult tooth, handle it by the crown, gently rinse it if needed, and place it back in the socket or keep it in milk. See a dentist as soon as possible, ideally within 30 to 60 minutes.\n\n" +
  "For uncontrolled bleeding, bite firmly on clean gauze for 15 to 20 minutes. Facial swelling with fever or trouble breathing or swallowing needs emergency medical care. Use the emergency link below to find urgent dental help.";

export const GREETING_REPLIES = [
  "Hi! I am Dr. Denta, DentHub's dental assistant. I can share general guidance about teeth, gums, treatments, costs, kids' dentistry, and emergencies. What would you like to know?",
  "Hello! I am Dr. Denta. Ask about cavities, braces, whitening, bleeding gums, toothaches, or urgent dental care.",
];

export const THANKS_REPLIES = [
  "You are welcome. Take care of your teeth, and ask again if you have another question.",
  "Happy to help. I am here when you need general dental guidance.",
];

export const FALLBACK_REPLY =
  "I am not sure about that question, but I can help with cavities, toothache, gum disease, sensitivity, whitening, braces, wisdom teeth, root canals, implants, dentures, kids' teeth, brushing, costs, and emergencies.\n\n" +
  "Try rephrasing your question or choose one of the suggestions. For a proper assessment, book a dentist through DentHub.";

export const GUARDRAIL_REPLY =
  "I cannot diagnose a condition, confirm what a symptom means, or tell you which medicine to take. A dentist needs to examine you for that.\n\n" +
  "You can share how long it has lasted, where the discomfort is, and whether there is swelling or fever. Seek urgent care for severe pain, facial swelling, uncontrolled bleeding, a knocked-out tooth, or trouble breathing or swallowing.";

export const DENTAL_KNOWLEDGE: DentalTopic[] = [
  {
    id: "cavities",
    keywords: [
      "cavity",
      "cavities",
      "tooth decay",
      "decay",
      "caries",
      "hole in tooth",
      "hole in my tooth",
      "rotten tooth",
      "rotting",
    ],
    answer:
      "Cavities are damaged areas in the hard surface of a tooth. Bacteria use sugars to make acid that weakens enamel. Common signs include toothache, sensitivity, dark spots, or pain when biting.\n\n" +
      "Treatment depends on severity and may include a filling, a crown, or root canal treatment. Brush twice daily with fluoride toothpaste, clean between teeth, limit sugary snacks, and keep regular dental check-ups.",
    related: ["How do I prevent cavities?", "How is a filling done?", "What is a root canal?"],
  },
  {
    id: "toothache",
    keywords: [
      "toothache",
      "tooth ache",
      "tooth pain",
      "my tooth hurts",
      "painful tooth",
      "aching tooth",
      "sore tooth",
    ],
    answer:
      "A toothache can happen because of decay, a cracked tooth, a lost filling, an exposed root, trapped food, or a gum infection. You can rinse gently with warm salt water, floss around the tooth, avoid very hot, cold, or sugary foods, and use a cold compress on the cheek.\n\n" +
      "See a dentist promptly if the pain is severe, throbbing, keeps you awake, or comes with swelling or fever. Home care may ease symptoms but does not fix the cause.",
    related: ["Could this be an abscess?", "Find a dentist near me", "What is a root canal?"],
  },
  {
    id: "sensitivity",
    keywords: [
      "sensitive teeth",
      "sensitivity",
      "teeth hurt cold",
      "hurts when i drink cold",
      "sensitive to hot",
      "sensitive to cold",
      "sensitive to sweet",
      "twinge",
    ],
    answer:
      "Tooth sensitivity is a sharp twinge with hot, cold, sweet, or acidic foods. It can happen when enamel wears down or gums recede and expose the softer dentine.\n\n" +
      "Try a desensitising toothpaste, a soft-bristled brush, and gentle brushing. Avoid acidic drinks and do not brush immediately after acidic foods. See a dentist if sensitivity persists or affects one specific tooth.",
    related: ["Why are my gums receding?", "How do I brush gently?", "Could this be decay?"],
  },
  {
    id: "gum-disease",
    keywords: [
      "gum disease",
      "gingivitis",
      "periodontitis",
      "periodontal",
      "bleeding gums",
      "gums bleed",
      "gum infection",
      "receding gums",
      "gum recession",
      "swollen gums",
      "sore gums",
    ],
    answer:
      "Gum disease starts as gingivitis, which can cause red, swollen gums that bleed while brushing or flossing. It is often reversible with good cleaning. If it is not treated, it can affect the gums and supporting bone and lead to tooth loss.\n\n" +
      "Brush twice daily, clean between teeth every day, and have regular professional cleanings. Do not ignore bleeding gums, and speak with a dentist if the bleeding continues.",
    related: [
      "How do I floss properly?",
      "What is scaling and polishing?",
      "How often should I see a dentist?",
    ],
  },
  {
    id: "bad-breath",
    keywords: ["bad breath", "halitosis", "smelly breath", "mouth odor", "mouth odour"],
    answer:
      "Persistent bad breath often comes from bacteria on the tongue and between teeth, gum disease, dry mouth, food, smoking, or another health condition.\n\n" +
      "Brush twice daily, clean your tongue, clean between teeth, stay hydrated, and limit coffee, garlic, onions, and tobacco. Sugar-free gum can help stimulate saliva. A dentist can assess persistent halitosis.",
    related: ["Could I have gum disease?", "How do I clean my tongue?", "What causes dry mouth?"],
  },
  {
    id: "whitening",
    keywords: [
      "whitening",
      "whiten",
      "whiter teeth",
      "teeth whitening",
      "bleaching",
      "stained teeth",
      "yellow teeth",
      "discoloured",
      "discolored",
    ],
    answer:
      "Teeth can become yellow from age, coffee, tea, red wine, tobacco, and some foods. Whitening can lift some surface stains.\n\n" +
      "A dentist can provide in-chair whitening or custom take-home trays. Whitening toothpastes mainly help with surface stains. Whitening does not change crowns, veneers, or fillings and can temporarily increase sensitivity, so discuss safe options with a dentist.",
    related: ["Will whitening hurt my teeth?", "What are veneers?", "How can I prevent stains?"],
  },
  {
    id: "braces",
    keywords: [
      "braces",
      "orthodontics",
      "orthodontist",
      "crooked teeth",
      "crowded teeth",
      "straighten",
      "aligners",
      "invisalign",
      "clear aligners",
      "overbite",
      "underbite",
      "gap in teeth",
    ],
    answer:
      "Orthodontics can straighten crooked or crowded teeth and correct bites. Common options include metal braces, tooth-coloured braces, and removable clear aligners.\n\n" +
      "Treatment time and suitability depend on the bite and the teeth involved. A consultation with a dentist or orthodontist is the best way to choose a safe plan, and a retainer may be needed afterwards.",
    related: ["How much do braces cost?", "Braces vs clear aligners", "How long do braces take?"],
  },
  {
    id: "wisdom-teeth",
    keywords: [
      "wisdom tooth",
      "wisdom teeth",
      "third molar",
      "impacted tooth",
      "impacted wisdom",
      "back tooth coming in",
    ],
    answer:
      "Wisdom teeth are the third molars at the back of the mouth. They may grow normally, become crowded, or stay partly trapped under the gum.\n\n" +
      "Pain, swelling, infection, decay, or crowding can happen around them. Not every wisdom tooth needs removal. A dentist can examine the tooth and use an X-ray to advise whether removal or monitoring is appropriate.",
    related: [
      "Does wisdom tooth removal hurt?",
      "What is pericoronitis?",
      "How does recovery after extraction work?",
    ],
  },
  {
    id: "root-canal",
    keywords: ["root canal", "endodontic", "rct", "nerve removed", "dead tooth", "nerve treatment"],
    answer:
      "A root canal treats a tooth whose pulp is badly inflamed or infected, often because of deep decay, a crack, or trauma. The dentist removes the infected pulp, cleans the canals, and seals the tooth.\n\n" +
      "Lingering severe pain, pain when biting, swelling, or sensitivity that lasts after hot or cold can be signs that a tooth needs assessment. Modern treatment is usually more comfortable than many people expect.",
    related: ["Is a root canal painful?", "Will I need a crown?", "Could this be an abscess?"],
  },
  {
    id: "extraction",
    keywords: [
      "extraction",
      "pull tooth",
      "pull a tooth",
      "remove tooth",
      "tooth removed",
      "after extraction",
      "dry socket",
    ],
    answer:
      "A dentist may remove a tooth when it has severe decay, advanced gum disease, significant damage, or an impacted wisdom tooth. The procedure is usually done with local anaesthetic.\n\n" +
      "Afterwards, bite on gauze for bleeding control, avoid smoking, straws, and vigorous rinsing for the first day, and eat soft foods. Contact a dentist for worsening pain after a few days, heavy bleeding, or swelling with fever.",
    related: [
      "What is dry socket?",
      "How do I replace a missing tooth?",
      "What is the healing time?",
    ],
  },
  {
    id: "implants",
    keywords: [
      "implant",
      "implants",
      "dental implant",
      "replace missing tooth",
      "missing tooth",
      "lost a tooth",
      "fake tooth",
    ],
    answer:
      "A dental implant is a small post placed in the jawbone to replace a missing tooth root, with a crown fitted on top. It can look and feel like a natural tooth and may help protect nearby teeth.\n\n" +
      "The process takes time and requires healthy gums and enough bone. A dentist will assess suitability with an examination and imaging. Implants can cost more than bridges or dentures.",
    related: [
      "Implant vs bridge vs denture",
      "How much do implants cost?",
      "Are implants painful?",
    ],
  },
  {
    id: "brushing",
    keywords: [
      "how to brush",
      "brushing",
      "brush my teeth",
      "brush properly",
      "best toothbrush",
      "electric toothbrush",
      "how long to brush",
    ],
    answer:
      "Brush twice a day for about two minutes with fluoride toothpaste and a soft-bristled brush. Angle the brush gently toward the gumline and use small movements rather than scrubbing hard.\n\n" +
      "Clean the outer, inner, and chewing surfaces, including the backs of the back teeth. Spit after brushing and replace a manual brush or electric brush head about every three months or when the bristles wear.",
    related: ["How do I floss?", "Is fluoride safe?", "Should I use mouthwash?"],
  },
  {
    id: "flossing",
    keywords: [
      "floss",
      "flossing",
      "between teeth",
      "interdental",
      "dental floss",
      "water flosser",
    ],
    answer:
      "Cleaning between teeth removes plaque that a toothbrush cannot reach and helps prevent cavities and gum disease. Use floss gently in a C shape against each tooth, or consider interdental brushes or a water flosser.\n\n" +
      "Clean between teeth once a day. Mild bleeding can happen at first, especially if gums are inflamed, but persistent bleeding should be discussed with a dentist.",
    related: ["Best way to brush", "Why do my gums bleed?", "Interdental brushes vs floss"],
  },
  {
    id: "kids",
    keywords: [
      "child",
      "children",
      "kid",
      "kids",
      "baby teeth",
      "baby tooth",
      "toddler",
      "teething",
      "milk teeth",
      "first dental visit",
    ],
    answer:
      "Start cleaning as soon as the first tooth appears. Use a smear of fluoride toothpaste for a young child and supervise brushing until about age seven.\n\n" +
      "Limit sugary drinks, especially in bottles at bedtime, and arrange a first dental visit by the first birthday or soon after the first tooth appears. Early visits help children feel comfortable with dental care.",
    related: [
      "How much toothpaste for kids?",
      "How do I help with teething?",
      "When do baby teeth fall out?",
    ],
  },
  {
    id: "pregnancy",
    keywords: [
      "pregnant",
      "pregnancy",
      "expecting",
      "gums during pregnancy",
      "dental care pregnant",
    ],
    answer:
      "Routine dental care is important during pregnancy. Hormonal changes can make gums more prone to swelling and bleeding, so keep brushing twice daily and cleaning between teeth.\n\n" +
      "Tell your dentist that you are pregnant. If you have morning sickness, rinse with water after vomiting and wait before brushing so the enamel is not brushed while it is softened. Discuss any dental problem promptly.",
    related: [
      "Why are my gums bleeding?",
      "Is dental X-ray safe in pregnancy?",
      "Morning sickness and teeth",
    ],
  },
  {
    id: "grinding-tmj",
    keywords: [
      "grinding",
      "grind my teeth",
      "bruxism",
      "clenching",
      "jaw pain",
      "tmj",
      "tmd",
      "jaw clicks",
      "night guard",
      "mouth guard",
    ],
    answer:
      "Teeth grinding or clenching can happen during sleep or stress. It may lead to worn teeth, jaw pain, headaches, tooth sensitivity, or clicking.\n\n" +
      "A dentist may recommend a custom night guard. Reducing caffeine and alcohol, managing stress, using a warm compress, and doing gentle jaw stretches may help. Seek care for persistent pain or a jaw that locks.",
    related: ["Do I need a night guard?", "Why do I wake with headaches?", "My jaw clicks"],
  },
  {
    id: "ulcers",
    keywords: ["ulcer", "mouth ulcer", "canker sore", "sore in mouth", "mouth sore", "cold sore"],
    answer:
      "Mouth ulcers are small, painful sores inside the mouth and often heal within one to two weeks. Biting, stress, sharp teeth, braces, and some medical conditions can trigger them.\n\n" +
      "Avoid spicy, acidic, or salty foods and consider a pharmacist-approved ulcer product. See a dentist or doctor if a sore lasts more than three weeks, returns often, is unusually large, or has other concerning changes.",
    related: [
      "When should a mouth sore be checked?",
      "What causes recurring ulcers?",
      "What are signs of oral cancer?",
    ],
  },
  {
    id: "dry-mouth",
    keywords: ["dry mouth", "xerostomia", "no saliva", "mouth feels dry", "thirsty mouth"],
    answer:
      "Dry mouth happens when the mouth does not make enough saliva. It can increase the risk of cavities, gum disease, and bad breath. Medicines, dehydration, mouth breathing, smoking, and health conditions can contribute.\n\n" +
      "Sip water, chew sugar-free gum, limit caffeine and alcohol, and consider a saliva substitute if a clinician recommends it. Keep up fluoride brushing and regular dental visits because cavity risk may be higher.",
    related: [
      "How do I prevent cavities?",
      "What causes bad breath?",
      "What toothpaste helps dry mouth?",
    ],
  },
  {
    id: "oral-cancer",
    keywords: [
      "oral cancer",
      "mouth cancer",
      "lump in mouth",
      "white patch",
      "red patch",
      "cancer screening",
      "tongue lump",
    ],
    answer:
      "Regular dental visits can help find changes in the mouth early. A sore that does not heal, a lump or thickening, red or white patches, persistent numbness, difficulty swallowing, or unexplained loose teeth deserves prompt professional assessment.\n\n" +
      "Tobacco, heavy alcohol use, and HPV can increase risk. I cannot diagnose a patch or lump, so arrange an examination with a dentist or doctor rather than waiting.",
    related: [
      "When should a mouth sore be checked?",
      "How does smoking affect teeth?",
      "Book a dental check-up",
    ],
  },
  {
    id: "smoking",
    keywords: ["smoking", "smoke", "tobacco", "vaping", "vape", "cigarettes", "shisha"],
    answer:
      "Smoking and tobacco can stain teeth, cause bad breath, reduce healing, and increase the risk of gum disease, tooth loss, implant problems, and oral cancer. Vaping is not risk-free and can contribute to dry mouth and gum irritation.\n\n" +
      "Quitting can improve oral health, and a dentist can help with staining, gum care, and a plan for healthier habits. Your doctor can support quitting support.",
    related: [
      "How can I whiten stained teeth?",
      "What is gum disease?",
      "What are signs of oral cancer?",
    ],
  },
  {
    id: "checkup-frequency",
    keywords: [
      "how often dentist",
      "how often check",
      "how often should i",
      "dental visit frequency",
      "when to see dentist",
      "regular check up",
      "checkup",
    ],
    answer:
      "Many people benefit from a dental check-up about every six months, although the right interval depends on cavities, gum disease, smoking, medical conditions, and other risk factors.\n\n" +
      "Regular visits help find problems early and often include a professional cleaning. A dentist can recommend a schedule that fits your mouth and health history.",
    related: ["Find a dentist near me", "What happens at a check-up?", "What is scaling?"],
  },
  {
    id: "cost",
    keywords: [
      "cost",
      "price",
      "how much",
      "expensive",
      "afford",
      "fees",
      "charge",
      "insurance",
      "payment plan",
    ],
    answer:
      "Dental prices vary by country, clinic, and treatment. Check-ups and cleanings are generally more affordable than crowns, root canals, braces, or implants.\n\n" +
      "Ask a clinic about insurance, instalment plans, and a written estimate. DentHub can help you compare providers, but an exact price requires an examination and a quote from the clinic.",
    related: ["Find a dentist near me", "How much do braces cost?", "How much do implants cost?"],
  },
  {
    id: "anxiety",
    keywords: [
      "scared of dentist",
      "dental anxiety",
      "afraid of dentist",
      "nervous dentist",
      "fear of dentist",
      "dentist phobia",
      "hate the dentist",
    ],
    answer:
      "Dental anxiety is common and dentists are used to helping nervous patients. Tell the clinic when booking, agree on a stop signal, bring headphones, and ask for a simple check-up when you are ready.\n\n" +
      "Slow breathing and a calm first visit can help build trust. If fear is strong, ask about additional time, sedation options, or a clinic that specialises in anxious patients.",
    related: ["Find a gentle dentist", "Does a check-up hurt?", "What is sedation dentistry?"],
  },
  {
    id: "veneers",
    keywords: ["veneer", "veneers", "cosmetic", "smile makeover", "chipped tooth"],
    answer:
      "Veneers are thin custom shells bonded to the front of teeth to improve colour, shape, or gaps. Porcelain may be durable and stain-resistant, while composite can be repaired more easily.\n\n" +
      "Some veneers require a small amount of enamel preparation, and whitening does not change them. A dentist can discuss whether bonding, a veneer, or another treatment is appropriate.",
    related: ["Veneers vs crowns", "I chipped my front tooth", "How do I whiten teeth?"],
  },
  {
    id: "what-is-denthub",
    keywords: [
      "what is denthub",
      "about denthub",
      "who are you",
      "what can you do",
      "how does denthub work",
    ],
    answer:
      "DentHub connects people with dentists and clinics for care, appointments, oral-care products, jobs, and training. I am Dr. Denta, the built-in assistant for general dental guidance.\n\n" +
      "I can explain common topics and point you toward a dentist, but I cannot diagnose or prescribe. What would you like to know?",
    related: [
      "Find a dentist near me",
      "I have a dental emergency",
      "How often should I see a dentist?",
    ],
  },
];
