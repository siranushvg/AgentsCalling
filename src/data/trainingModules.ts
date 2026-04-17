export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface TrainingLesson {
  title: string;
  content: string;
}

export interface TrainingExample {
  label: string;
  detail: string;
}

export interface TrainingModule {
  id: number;
  title: string;
  desc: string;
  duration: string;
  icon: string;
  intro: string;
  lessons: TrainingLesson[];
  examples?: TrainingExample[];
  goal: string;
  quiz: QuizQuestion[];
}

export const trainingModules: TrainingModule[] = [
  {
    id: 1,
    title: 'Arena365 Platform Overview',
    desc: 'Understand the product you are selling',
    duration: '10 min',
    icon: 'globe',
    intro: 'Before you make your first call, you need to understand exactly what Arena365 is — the products, the sports, and why customers choose it.',
    lessons: [
      {
        title: 'What is Arena365?',
        content: 'Arena365 is a cricket-centric online sportsbook built for the Indian market. It offers real-money betting on live and pre-match events across multiple sports. The platform is designed for fast deposits via UPI, instant betting, and quick withdrawals.',
      },
      {
        title: 'Sports Available',
        content: 'While cricket is the primary focus (IPL, internationals, domestic leagues), Arena365 also covers soccer, tennis, basketball, ice hockey, handball, volleyball, baseball, badminton, and rugby. This gives customers year-round betting options even outside cricket season.',
      },
      {
        title: 'Casino & Games',
        content: 'Arena365 features casino games from major providers including Aviator (a hugely popular crash game), live dealer tables, slots, and instant-win games. Aviator is one of the most played games on Arena365 and is central to several promotions.',
      },
      {
        title: 'Why Customers Choose Arena365',
        content: 'Fast UPI deposits (100 INR minimum), competitive odds on cricket, generous welcome bonuses, regular Aviator promotions, and a simple mobile-friendly interface. The platform is designed for users who want to start playing quickly with minimal friction.',
      },
    ],
    goal: 'You should be able to explain what Arena365 is in one sentence and list the key sports and features confidently.',
    quiz: [
      {
        id: 'q1-1',
        question: 'What is the primary sport focus of Arena365?',
        options: ['Soccer', 'Cricket', 'Tennis', 'Basketball'],
        correctIndex: 1,
        explanation: 'Arena365 is a cricket-centric sportsbook built primarily for the Indian market.',
      },
      {
        id: 'q1-2',
        question: 'Which of the following is NOT a sport available on Arena365?',
        options: ['Handball', 'Volleyball', 'Golf', 'Rugby'],
        correctIndex: 2,
        explanation: 'Golf is not listed among the sports available on Arena365. The platform covers cricket, soccer, tennis, basketball, ice hockey, handball, volleyball, baseball, badminton, and rugby.',
      },
      {
        id: 'q1-3',
        question: 'What is Aviator on Arena365?',
        options: ['A flight simulator game', 'A popular crash/instant-win game', 'A sports betting market', 'A payment method'],
        correctIndex: 1,
        explanation: 'Aviator is a hugely popular crash game on Arena365 and is central to several Arena365 promotions.',
      },
    ],
  },
  {
    id: 2,
    title: 'Sportsbook Welcome Bonus 150%',
    desc: 'Master the first-deposit bonus offer',
    duration: '15 min',
    icon: 'gift',
    intro: 'The 150% Sportsbook Welcome Bonus is the primary offer you will pitch to new customers. You must know every detail — eligibility, limits, wagering, and expiry.',
    lessons: [
      {
        title: 'What is the Welcome Bonus?',
        content: 'Arena365 offers a 150% match bonus on a new customer\'s first deposit. This means the customer receives 1.5x their deposit amount as bonus funds. This bonus is exclusive to sportsbook betting.',
      },
      {
        title: 'Eligibility & Limits',
        content: 'Only new customers on their very first deposit qualify. Minimum deposit is ₹100. Maximum bonus amount is ₹5,000. The bonus activates automatically after the qualifying deposit is made.',
      },
      {
        title: 'Wagering Requirements',
        content: 'The bonus amount must be wagered 10x before it becomes withdrawable. Only sportsbook bets with odds of 1.60 or higher count towards wagering. Casino bets, Aviator, and low-odds bets do NOT count.',
      },
      {
        title: 'Validity & Expiry',
        content: 'The bonus is valid for 5 days from the date of activation. Any unused bonus funds expire automatically after 5 days. There is no extension or reactivation once expired.',
      },
    ],
    examples: [
      {
        label: 'Deposit ₹1,000',
        detail: 'Customer deposits ₹1,000 → receives ₹1,500 bonus → must wager ₹15,000 on sportsbook bets (odds 1.60+) within 5 days to make the bonus withdrawable.',
      },
      {
        label: 'Deposit ₹3,334 (max bonus)',
        detail: 'Customer deposits ₹3,334 → receives ₹5,000 bonus (capped at max) → must wager ₹50,000 on qualifying bets within 5 days.',
      },
    ],
    goal: 'You should be able to clearly explain who qualifies, the bonus amount, wagering rules, and what happens if the bonus expires.',
    quiz: [
      {
        id: 'q2-1',
        question: 'What is the match percentage of the Welcome Bonus?',
        options: ['100%', '125%', '150%', '200%'],
        correctIndex: 2,
        explanation: 'The Welcome Bonus is a 150% match on the first deposit.',
      },
      {
        id: 'q2-2',
        question: 'What is the maximum bonus a customer can receive?',
        options: ['₹1,000', '₹3,000', '₹5,000', '₹10,000'],
        correctIndex: 2,
        explanation: 'The maximum bonus amount is capped at ₹5,000.',
      },
      {
        id: 'q2-3',
        question: 'A customer deposits ₹1,000. How much must they wager to make the bonus withdrawable?',
        options: ['₹1,000', '₹1,500', '₹10,000', '₹15,000'],
        correctIndex: 3,
        explanation: '₹1,000 deposit gives ₹1,500 bonus. Wagering = ₹1,500 × 10 = ₹15,000 on sportsbook bets with odds 1.60+.',
      },
      {
        id: 'q2-4',
        question: 'Which bets count towards wagering the Welcome Bonus?',
        options: ['Any bet on Arena365', 'Sportsbook bets with odds 1.60 or higher', 'Aviator bets only', 'Casino slots only'],
        correctIndex: 1,
        explanation: 'Only sportsbook bets with odds of 1.60 or higher count towards the 10x wagering requirement.',
      },
    ],
  },
  {
    id: 3,
    title: 'Aviator Free Rounds Offer',
    desc: 'Understand the recurring deposit promotion',
    duration: '15 min',
    icon: 'plane',
    intro: 'The Aviator Free Rounds offer is a recurring promotion available from the second deposit onward. It\'s a key retention tool and you need to explain the tiers clearly.',
    lessons: [
      {
        title: 'When Does This Offer Start?',
        content: 'The Aviator Free Rounds offer starts from the customer\'s second deposit onward. It does NOT apply to the first deposit (that\'s the Welcome Bonus). Every qualifying deposit after the first triggers free rounds.',
      },
      {
        title: 'How Many Free Rounds?',
        content: 'Every qualifying deposit gives the customer 25 free rounds on Aviator. The value per round depends on how much they deposit. Free rounds are auto-credited after the qualifying deposit.',
      },
      {
        title: 'Deposit Tiers',
        content: 'The value of each free round depends on the deposit amount:\n\n• ₹500 – ₹2,999 → 25 rounds at ₹10 each\n• ₹3,000 – ₹7,999 → 25 rounds at ₹50 each\n• ₹8,000 – ₹14,999 → 25 rounds at ₹100 each\n• ₹15,000+ → 25 rounds at ₹200 each',
      },
      {
        title: 'Important Restrictions',
        content: 'Free rounds are ONLY for Aviator — they cannot be used on any other game. Rounds are auto-credited and must be used within 24 hours or they expire. This offer applies to every qualifying deposit, making it a great reason for customers to keep depositing.',
      },
    ],
    examples: [
      {
        label: 'Deposit ₹500',
        detail: 'Customer deposits ₹500 (second deposit) → receives 25 free rounds at ₹10 each (total value ₹250) → rounds auto-credited → must be used within 24 hours on Aviator.',
      },
      {
        label: 'Deposit ₹15,000',
        detail: 'Customer deposits ₹15,000 → receives 25 free rounds at ₹200 each (total value ₹5,000) → auto-credited → use within 24 hours on Aviator.',
      },
    ],
    goal: 'You should be able to explain when the offer starts, the four deposit tiers, and that it only works on Aviator.',
    quiz: [
      {
        id: 'q3-1',
        question: 'When does the Aviator Free Rounds offer start?',
        options: ['From the first deposit', 'From the second deposit onward', 'Only on the third deposit', 'Only during IPL season'],
        correctIndex: 1,
        explanation: 'The Aviator Free Rounds offer starts from the second deposit onward. The first deposit qualifies for the Welcome Bonus instead.',
      },
      {
        id: 'q3-2',
        question: 'A customer deposits ₹3,000. What value are their free rounds?',
        options: ['₹10 each', '₹50 each', '₹100 each', '₹200 each'],
        correctIndex: 1,
        explanation: '₹3,000 falls in the ₹3,000–₹7,999 tier, which gives 25 rounds at ₹50 each.',
      },
      {
        id: 'q3-3',
        question: 'How long are free rounds valid?',
        options: ['12 hours', '24 hours', '48 hours', '5 days'],
        correctIndex: 1,
        explanation: 'Free rounds must be used within 24 hours or they expire automatically.',
      },
    ],
  },
  {
    id: 4,
    title: 'Winnings, Wagering & Validity',
    desc: 'Know how bonus winnings become withdrawable',
    duration: '15 min',
    icon: 'calculator',
    intro: 'This is where most customer confusion happens. You need to clearly explain how winnings from free rounds work, the wagering requirement, and expiry rules.',
    lessons: [
      {
        title: 'How Winnings Work',
        content: 'Any winnings from Aviator free rounds are credited as bonus balance — not real cash. This means the customer cannot withdraw them immediately. The winnings must be wagered first.',
      },
      {
        title: 'Wagering Requirement on Winnings',
        content: 'Bonus winnings from free rounds require 25x wagering before they become withdrawable. Only Aviator bets count towards this wagering requirement. Sportsbook or other casino bets do NOT count.',
      },
      {
        title: 'Validity Rules',
        content: 'Free rounds must be used within 24 hours of being credited. Bonus winnings from those rounds must be wagered within 5 days. If either deadline is missed, the rounds or bonus funds expire automatically — no extensions.',
      },
      {
        title: 'Key Difference from Welcome Bonus',
        content: 'Welcome Bonus wagering: 10x on sportsbook (odds 1.60+), valid 5 days.\nAviator winnings wagering: 25x on Aviator only, valid 5 days.\nThese are completely separate requirements — do not mix them up on calls.',
      },
    ],
    examples: [
      {
        label: 'Full Example',
        detail: 'Customer deposits ₹3,000 (2nd deposit) → receives 25 free rounds at ₹50 → wins ₹500 from those rounds → ₹500 credited as bonus → wagering required = ₹500 × 25 = ₹12,500 on Aviator → must complete within 5 days.',
      },
    ],
    goal: 'You should be able to walk a customer through: "I won ₹X from free rounds — when can I withdraw it?"',
    quiz: [
      {
        id: 'q4-1',
        question: 'How are winnings from free rounds credited?',
        options: ['As real cash', 'As bonus balance', 'As free bets', 'Directly to UPI'],
        correctIndex: 1,
        explanation: 'Winnings from free rounds are credited as bonus balance, not real cash. They must be wagered before withdrawal.',
      },
      {
        id: 'q4-2',
        question: 'What is the wagering requirement on free round winnings?',
        options: ['10x', '15x', '20x', '25x'],
        correctIndex: 3,
        explanation: 'Bonus winnings from Aviator free rounds require 25x wagering on Aviator bets.',
      },
      {
        id: 'q4-3',
        question: 'A customer wins ₹500 from free rounds. How much must they wager?',
        options: ['₹500', '₹5,000', '₹10,000', '₹12,500'],
        correctIndex: 3,
        explanation: '₹500 × 25x = ₹12,500 wagering required on Aviator.',
      },
      {
        id: 'q4-4',
        question: 'How long does the customer have to complete wagering on free round winnings?',
        options: ['24 hours', '3 days', '5 days', '7 days'],
        correctIndex: 2,
        explanation: 'Bonus winnings must be wagered within 5 days of being credited.',
      },
    ],
  },
  {
    id: 5,
    title: 'Deposit & Withdrawal Rules',
    desc: 'Know the money-in and money-out process',
    duration: '10 min',
    icon: 'wallet',
    intro: 'Customers will frequently ask about deposits and withdrawals. You need to know the exact rules so you can answer confidently without hesitation.',
    lessons: [
      {
        title: 'Deposit Rules',
        content: 'Deposits are made via UPI only. Minimum deposit is ₹100. There is no maximum deposit limit. Only the customer\'s personal UPI ID can be used — third-party payments are not accepted.',
      },
      {
        title: 'Deposit Wagering',
        content: 'All deposits must be wagered 1x before any withdrawal can be made. This is a standard anti-fraud measure. Example: deposit ₹1,000 → must place at least ₹1,000 in bets before requesting a withdrawal.',
      },
      {
        title: 'Withdrawal Rules',
        content: 'Minimum withdrawal is ₹500. There is no maximum withdrawal limit. Withdrawals can ONLY be sent to the same UPI account that was used for depositing — no alternative accounts.',
      },
      {
        title: 'Common Customer Questions',
        content: '"Why can\'t I withdraw?" — Check if they\'ve met 1x deposit wagering, bonus wagering, and minimum ₹500 balance.\n"Can I use someone else\'s UPI?" — No, only the account holder\'s personal UPI is accepted for both deposit and withdrawal.',
      },
    ],
    goal: 'You should be able to explain deposit methods, limits, wagering rules, and withdrawal conditions without looking anything up.',
    quiz: [
      {
        id: 'q5-1',
        question: 'What is the minimum deposit amount?',
        options: ['₹50', '₹100', '₹200', '₹500'],
        correctIndex: 1,
        explanation: 'The minimum deposit is ₹100 via UPI.',
      },
      {
        id: 'q5-2',
        question: 'How many times must a deposit be wagered before withdrawal?',
        options: ['No wagering needed', '1x', '5x', '10x'],
        correctIndex: 1,
        explanation: 'All deposits must be wagered 1x before withdrawal as an anti-fraud measure.',
      },
      {
        id: 'q5-3',
        question: 'What is the minimum withdrawal amount?',
        options: ['₹100', '₹200', '₹500', '₹1,000'],
        correctIndex: 2,
        explanation: 'The minimum withdrawal amount is ₹500.',
      },
      {
        id: 'q5-4',
        question: 'Can a customer withdraw to a different UPI account than they deposited from?',
        options: ['Yes, any UPI account', 'Yes, but only family members', 'No, same UPI account only', 'Only if verified by support'],
        correctIndex: 2,
        explanation: 'Withdrawals can only be sent to the same UPI account used for depositing.',
      },
    ],
  },
  {
    id: 6,
    title: 'Offer Comparison & Customer Guidance',
    desc: 'Know which offer applies in which situation',
    duration: '10 min',
    icon: 'scale',
    intro: 'The two main offers — Welcome Bonus and Aviator Free Rounds — apply in different situations. You must never confuse them or give wrong information.',
    lessons: [
      {
        title: 'First Deposit → Welcome Bonus',
        content: 'New customer, first ever deposit → 150% Sportsbook Welcome Bonus. Maximum ₹5,000 bonus. 10x wagering on sportsbook (odds 1.60+). Valid 5 days. No Aviator free rounds on first deposit.',
      },
      {
        title: 'Second Deposit Onward → Aviator Free Rounds',
        content: 'Any deposit from the second onward → 25 Aviator Free Rounds. Round value depends on deposit tier. Winnings are bonus balance requiring 25x wagering on Aviator. Rounds valid 24 hours, winnings valid 5 days.',
      },
      {
        title: 'How to Identify Which Offer Applies',
        content: 'Ask the customer: "Is this your first deposit on Arena365?" If yes → explain the Welcome Bonus. If no → explain the Aviator Free Rounds. Never promise both offers on the same deposit.',
      },
      {
        title: 'Avoiding Confusion',
        content: 'Common mistake: telling a returning customer they get a 150% bonus (they don\'t — that\'s first deposit only). Common mistake: telling a new customer about free rounds on their first deposit (they don\'t qualify yet). Always clarify which deposit number this is before explaining any offer.',
      },
    ],
    goal: 'You should instantly know which offer applies based on whether it\'s a first deposit or subsequent deposit.',
    quiz: [
      {
        id: 'q6-1',
        question: 'A new customer makes their first deposit. Which offer applies?',
        options: ['Aviator Free Rounds', '150% Sportsbook Welcome Bonus', 'Both offers', 'No offer on first deposit'],
        correctIndex: 1,
        explanation: 'The first deposit triggers the 150% Sportsbook Welcome Bonus only.',
      },
      {
        id: 'q6-2',
        question: 'An existing customer makes their 4th deposit. Which offer applies?',
        options: ['150% Welcome Bonus', 'Aviator Free Rounds', 'Both offers', 'No offer available'],
        correctIndex: 1,
        explanation: 'From the second deposit onward, the Aviator Free Rounds offer applies on every qualifying deposit.',
      },
      {
        id: 'q6-3',
        question: 'A returning customer asks "Can I get the 150% bonus again?" What do you say?',
        options: [
          '"Yes, it\'s available every time."',
          '"No, the 150% bonus is for first deposit only. But you get Aviator free rounds on every deposit."',
          '"Let me check with my manager."',
          '"You need to create a new account."',
        ],
        correctIndex: 1,
        explanation: 'The Welcome Bonus is a one-time first-deposit offer. Redirect the customer to the Aviator Free Rounds which are available on every subsequent deposit.',
      },
    ],
  },
  {
    id: 7,
    title: 'Customer Communication & Call Handling',
    desc: 'Handle real calls with confidence',
    duration: '15 min',
    icon: 'headset',
    intro: 'Knowing the product is only half the job. You need to communicate clearly, answer tough questions, and sound confident — every single call.',
    lessons: [
      {
        title: 'Opening the Call',
        content: 'Greet warmly: "Hi [name], this is [your name] calling from Arena365. How are you doing today?" Keep it natural and friendly. Don\'t rush into the pitch. Build 10 seconds of rapport first.',
      },
      {
        title: 'Explaining Offers Simply',
        content: 'Never use jargon. Say "you\'ll get ₹1,500 extra to bet with" instead of "150% match bonus". Say "you need to bet ₹15,000 total before you can cash out the bonus" instead of "10x wagering requirement". Customers don\'t understand technical terms.',
      },
      {
        title: 'Handling Common Questions',
        content: '"When can I withdraw?" → Explain 1x deposit wagering + any bonus wagering needed.\n"Why didn\'t I get the bonus?" → Check if it\'s their first deposit and if they met the minimum ₹100.\n"When do free rounds start?" → From the second deposit onward. First deposit gets the Welcome Bonus.\n"Why can\'t I withdraw yet?" → Check wagering progress, minimum ₹500 balance, and same UPI requirement.',
      },
      {
        title: 'Closing the Call',
        content: 'Always end with a clear next step: "So just go ahead and make your first deposit of at least ₹100 via UPI and your bonus will be activated automatically." Confirm the customer understood. Ask if they have any questions. Thank them.',
      },
      {
        title: 'What NOT to Do',
        content: 'Never guarantee winnings. Never promise withdrawal amounts. Never give wrong offer information. Never pressure the customer. Never make up answers — say "Let me confirm that for you" if unsure.',
      },
    ],
    goal: 'You should be able to handle a full call from greeting to close, answering any product question confidently.',
    quiz: [
      {
        id: 'q7-1',
        question: 'How should you explain the 150% bonus in simple terms?',
        options: [
          '"You get a 150% match bonus with 10x wagering at 1.60 odds minimum."',
          '"Deposit ₹1,000 and you\'ll get ₹1,500 extra to bet with on sports."',
          '"It\'s a complicated bonus structure, let me email you the details."',
          '"Just deposit and you\'ll see what happens."',
        ],
        correctIndex: 1,
        explanation: 'Use simple, customer-friendly language. Avoid jargon and give concrete examples with real numbers.',
      },
      {
        id: 'q7-2',
        question: 'A customer asks "Why can\'t I withdraw?" What should you check first?',
        options: [
          'Tell them to contact support',
          'Check deposit wagering, bonus wagering, minimum ₹500 balance, and same UPI',
          'Tell them they need to deposit more',
          'Say the system is probably slow',
        ],
        correctIndex: 1,
        explanation: 'Methodically check: 1x deposit wagering, any active bonus wagering, ₹500 minimum balance, and same UPI account requirement.',
      },
      {
        id: 'q7-3',
        question: 'What should you NEVER do on a call?',
        options: [
          'Explain the wagering requirements',
          'Ask if the customer has questions',
          'Guarantee specific winnings or withdrawal amounts',
          'Mention the Aviator free rounds',
        ],
        correctIndex: 2,
        explanation: 'Never guarantee winnings or withdrawal amounts. This is misleading and a compliance violation.',
      },
    ],
  },
  {
    id: 8,
    title: 'Final Certification Assessment',
    desc: 'Pass the final test to unlock live calling',
    duration: '20 min',
    icon: 'shield-check',
    intro: 'This is your final assessment. You must score 80% or higher to earn your Arena365 Calling Agent Certification and unlock access to live calling.',
    lessons: [
      {
        title: 'What to Expect',
        content: 'The final assessment includes 12 questions covering all modules. You need at least 10 correct answers (80%) to pass. Questions include product knowledge, scenario-based situations, and customer handling. You can retake the assessment if you don\'t pass on the first attempt.',
      },
      {
        title: 'Review Checklist',
        content: '✓ Arena365 platform and sports covered\n✓ 150% Welcome Bonus — eligibility, limits, wagering, validity\n✓ Aviator Free Rounds — tiers, deposit thresholds, validity\n✓ Winnings and wagering rules for both offers\n✓ Deposit and withdrawal rules (UPI, limits, same-account rule)\n✓ Which offer applies when (first vs subsequent deposits)\n✓ How to communicate offers in simple language\n✓ How to handle common customer objections',
      },
    ],
    goal: 'Pass the final assessment to earn your certification and unlock the live calling workspace.',
    quiz: [
      {
        id: 'q8-1',
        question: 'What is Arena365 primarily known as?',
        options: ['A poker platform', 'A cricket-centric sportsbook', 'A fantasy sports app', 'A casino-only platform'],
        correctIndex: 1,
        explanation: 'Arena365 is a cricket-centric online sportsbook built for the Indian market.',
      },
      {
        id: 'q8-2',
        question: 'What is the minimum first deposit to qualify for the Welcome Bonus?',
        options: ['₹50', '₹100', '₹500', '₹1,000'],
        correctIndex: 1,
        explanation: 'The minimum qualifying deposit for the 150% Welcome Bonus is ₹100.',
      },
      {
        id: 'q8-3',
        question: 'A customer deposits ₹2,000 for the first time. What bonus do they receive?',
        options: ['₹2,000', '₹3,000', '₹5,000', '₹1,000'],
        correctIndex: 1,
        explanation: '₹2,000 × 150% = ₹3,000 bonus (below the ₹5,000 cap).',
      },
      {
        id: 'q8-4',
        question: 'When do Aviator Free Rounds become available?',
        options: ['From the first deposit', 'From the second deposit onward', 'Only after the Welcome Bonus is wagered', 'Only on weekends'],
        correctIndex: 1,
        explanation: 'Aviator Free Rounds start from the second deposit onward.',
      },
      {
        id: 'q8-5',
        question: 'A customer deposits ₹8,000 (their 3rd deposit). What free rounds do they get?',
        options: ['25 rounds at ₹10', '25 rounds at ₹50', '25 rounds at ₹100', '25 rounds at ₹200'],
        correctIndex: 2,
        explanation: '₹8,000 falls in the ₹8,000–₹14,999 tier: 25 rounds at ₹100 each.',
      },
      {
        id: 'q8-6',
        question: 'What is the wagering requirement on Aviator free round winnings?',
        options: ['10x on sportsbook', '25x on Aviator', '15x on any game', 'No wagering needed'],
        correctIndex: 1,
        explanation: 'Free round winnings require 25x wagering on Aviator only.',
      },
      {
        id: 'q8-7',
        question: 'How long are free rounds valid after being credited?',
        options: ['12 hours', '24 hours', '48 hours', '5 days'],
        correctIndex: 1,
        explanation: 'Free rounds expire 24 hours after being credited.',
      },
      {
        id: 'q8-8',
        question: 'What payment method is used for deposits on Arena365?',
        options: ['Credit card', 'Bank transfer', 'UPI only', 'Crypto'],
        correctIndex: 2,
        explanation: 'Arena365 accepts deposits via UPI only.',
      },
      {
        id: 'q8-9',
        question: 'Can a customer withdraw to a different UPI than they deposited from?',
        options: ['Yes', 'No — same UPI account only', 'Yes, after verification', 'Only for VIP customers'],
        correctIndex: 1,
        explanation: 'Withdrawals must go to the same UPI account used for deposits.',
      },
      {
        id: 'q8-10',
        question: 'A returning customer asks for the 150% bonus. What do you tell them?',
        options: [
          '"Sure, let me activate it for you."',
          '"The 150% bonus is for first deposit only. On your next deposit, you\'ll get Aviator free rounds."',
          '"Create a new account to get it again."',
          '"I\'ll check if we can make an exception."',
        ],
        correctIndex: 1,
        explanation: 'The Welcome Bonus is first-deposit only. Redirect to the Aviator Free Rounds offer.',
      },
      {
        id: 'q8-11',
        question: 'A customer says "Why can\'t I withdraw?" What do you check?',
        options: [
          'Ask them to try again later',
          'Check 1x deposit wagering, bonus wagering, ₹500 minimum, same UPI',
          'Tell them to deposit more first',
          'Escalate to admin immediately',
        ],
        correctIndex: 1,
        explanation: 'Systematically check: deposit wagering (1x), any active bonus wagering, ₹500 minimum withdrawal, and same UPI account.',
      },
      {
        id: 'q8-12',
        question: 'What should you NEVER do on a customer call?',
        options: [
          'Explain the bonus clearly',
          'Ask discovery questions',
          'Guarantee specific winnings or promise withdrawal amounts',
          'End the call with a clear next step',
        ],
        correctIndex: 2,
        explanation: 'Never guarantee winnings or promise specific withdrawal amounts. This is misleading and a compliance violation.',
      },
    ],
  },
];

export const PASS_THRESHOLD = 0.8; // 80% to pass each module quiz
export const FINAL_PASS_THRESHOLD = 0.8; // 80% to pass final certification (10/12)
