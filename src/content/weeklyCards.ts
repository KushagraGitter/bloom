/**
 * The weekly cards: five for each week from 4 to 41, written once and shipped
 * inside the app, so nothing is fetched to show them. Drafted from the NHS
 * week-by-week guide in Bloom’s own words and reviewed in the “Bloom weekly
 * cards” doc. The baby card leaves out the size, which Today already shows.
 *
 * Rules the content test checks: no “normal” or “abnormal”, no “should” or
 * “must”, and short fronts and backs.
 */
import type { WeekCards } from '@/lib/weeklyCards';

export const WEEKLY_CARDS: Record<number, WeekCards> = {
  4: {
    baby: {
      front: 'A tiny new beginning',
      back: 'The embryo is settling in. A fluid-filled sac is forming around it, and a small yolk sac feeds it for now. The outer layer of cells has already started building the placenta, which will look after the baby for the months ahead.',
    },
    body: {
      front: 'Tired, tender, or nothing at all?',
      back: 'Some people notice sore breasts, tiredness, a stronger sense of smell or a little nausea. Plenty notice nothing yet, and that is fine too. Rest when you can, keep snacks handy, and ask your midwife or doctor about anything on your mind.',
    },
    try: {
      front: 'Start a daily folic acid habit',
      back: 'Folic acid supports the baby’s brain and spine in these early weeks. Ask your doctor or pharmacist which prenatal vitamin suits you, then add it on the Vitamins tab so Bloom can remind you each day.',
    },
    partner: {
      front: 'Be the calm in the big news',
      back: 'Big news brings big feelings: excited, anxious, or both in the same hour. Ask how she’s feeling today and just listen. Then take one job off her list, like cooking tonight or making the first appointment call.',
    },
    thought: {
      front: 'Something wonderful has quietly begun.',
      back: 'You don’t need to feel ready or know everything. You only need to take today as it comes. The rest will unfold one week at a time, and you won’t be doing it alone.',
    },
  },
  5: {
    baby: {
      front: 'The heart is starting to form',
      back: 'The brain and spinal cord are forming fast, and the tiny heart is taking shape, ready to begin beating very soon. Everything is still about 2mm long, yet the outline of a whole person is being drawn.',
    },
    body: {
      front: 'Wiped out by lunchtime?',
      back: 'Deep tiredness, nausea, a metallic taste, needing the loo more and mood swings are things some people notice now. Light spotting can happen too. Small, frequent meals help some. Tell your midwife or doctor about any bleeding or pain.',
    },
    try: {
      front: 'Book the first appointment',
      back: 'Call your midwife, GP or doctor to set up the first pregnancy appointment. Once it’s booked, add it to Appointments in Bloom so you both get a reminder and can jot down questions before you go.',
    },
    partner: {
      front: 'Stock a nausea kit',
      back: 'Put together a small kit: plain crackers, ginger biscuits or ginger tea, a water bottle and some mints. Leave one by the bed and one in her bag. Little things that are simply there can make a rough morning easier.',
    },
    thought: {
      front: 'Rest is productive right now.',
      back: 'Your body is doing huge, invisible work. If you need an early night, a nap or a slower day, that is part of the job, not a break from it.',
    },
  },
  6: {
    baby: {
      front: 'Arms, legs and ears begin',
      back: 'Small buds that will become arms and legs are appearing, and the ears are starting to form. The heart and brain keep developing quickly. Curled up, the embryo is now about 6mm long.',
    },
    body: {
      front: 'Smells suddenly too strong?',
      back: 'A sharper sense of smell, sickness at any time of day, tiredness and tender breasts are common now. Fresh air, cold foods and avoiding cooking smells can help. If you can’t keep food or drinks down, call your midwife or doctor.',
    },
    try: {
      front: 'Log how you feel, once a day',
      back: 'Open Mood & symptoms and note how today went, even in one word. Over the weeks it builds a picture you can bring to appointments, and it helps you spot which days and foods feel better.',
    },
    partner: {
      front: 'Take over the kitchen smells',
      back: 'If cooking smells are hard for her right now, take over the cooking or keep it simple: cold meals, open windows, the bin emptied often. Ask which smells are worst this week; they may change.',
    },
    thought: {
      front: 'One day at a time is enough.',
      back: 'Some days will feel lovely and some will feel like a slog. Both are part of this. You’re allowed to find it hard and still be happy about it.',
    },
  },
  7: {
    baby: {
      front: '100 new brain cells a minute',
      back: 'The brain is growing fast, making around 100 new cells every minute. The limb buds are lengthening and the eyelids are starting to form. The embryo is now about 1cm long.',
    },
    body: {
      front: 'Changes you can’t see yet',
      back: 'Nausea, tiredness, mood swings and sore breasts often carry on this week. Some people notice darker patches of skin or thicker hair. Gentle movement like a short walk can lift energy, even when it’s the last thing you feel like.',
    },
    try: {
      front: 'Take a 10-minute walk',
      back: 'If you feel up to it, a short walk in fresh air can ease nausea and lift your mood. Light activity suits most people in pregnancy; check with your midwife or doctor about what’s right for you.',
    },
    partner: {
      front: 'Plan a low-key date',
      back: 'Plan something easy together that doesn’t revolve around food or late nights: a film at home, a slow walk, a favourite show. The point is time for the two of you, not a big event.',
    },
    thought: {
      front: 'You are already caring for your baby.',
      back: 'Every glass of water, every rest and every vitamin is care. Long before anyone can see a bump, you are already looking after someone.',
    },
  },
  8: {
    baby: {
      front: 'Little arms and legs are growing',
      back: 'The baby is about 16mm long. The head is starting to uncurl, the arms are getting longer and the legs are developing, though the knees and ankles haven’t formed yet.',
    },
    body: {
      front: 'Bloated and ready for a nap?',
      back: 'Tiredness, nausea, bloating, needing to wee more and tender breasts are common around now. Comfortable clothes, small meals and an earlier bedtime can help. Your midwife or doctor is there for anything that feels off to you.',
    },
    try: {
      front: 'Start a questions list',
      back: 'Before the first appointment, write down what you want to ask: what to eat, which medicines are fine, when the first scan is. Add them as notes on the appointment in Bloom so neither of you forgets.',
    },
    partner: {
      front: 'Come to the first appointment',
      back: 'If you can, go along to the first appointment. Take notes, hold the questions list and ask your own questions too. You’ll both remember more, and being there for the early visits means a lot.',
    },
    thought: {
      front: 'Your feelings make sense.',
      back: 'Joy, worry, tiredness and wonder can all show up on the same day. None of them cancels the others. Be as kind to yourself as you would be to a friend.',
    },
  },
  9: {
    baby: {
      front: 'A little face is appearing',
      back: 'The baby now has a recognisable face, with eyes and eyelids, a mouth, and a tongue with tiny taste buds. The heart, brain, lungs, kidneys and gut are all forming, and the first bones are starting to develop.',
    },
    body: {
      front: 'Clothes feeling snug?',
      back: 'Some people notice their waist thickening and breasts growing. Tiredness, nausea, headaches and mood swings can still be around. Drinking water steadily through the day and resting when you can may help. Ask your midwife or doctor before taking any medicine.',
    },
    try: {
      front: 'Ask when your first scan is',
      back: 'The first scan is often offered between about 8 and 14 weeks. Ask your midwife or doctor when yours will be, then add it to Appointments so it’s on both phones.',
    },
    partner: {
      front: 'Ask, don’t guess',
      back: 'Instead of guessing what would help, ask a simple question: “What would make today easier?” The answer might be tiny, like a hot water bottle or quiet time. Doing that one thing well beats doing ten things she didn’t need.',
    },
    thought: {
      front: 'You’re growing someone’s very first smile.',
      back: 'Somewhere in there, a face is taking shape that you’ll one day know by heart. That’s worth a moment of wonder today.',
    },
  },
  10: {
    baby: {
      front: 'A heartbeat racing at 180',
      back: 'The heart is beating very fast, around 180 beats a minute. The face is filling out, with ears, nostrils and a delicate upper lip forming. The baby is about 3cm long from head to bottom.',
    },
    body: {
      front: 'Heartburn has entered the chat',
      back: 'Pregnancy hormones relax the muscles of the gut, so heartburn and bloating are common now, along with tiredness and nausea. Smaller meals and not lying down straight after eating can help. Your pharmacist can suggest what’s safe to take.',
    },
    try: {
      front: 'Check in on vitamin D',
      back: 'Many midwives and doctors suggest vitamin D in pregnancy, alongside folic acid. Ask yours whether you need it, and if so add it on the Vitamins tab.',
    },
    partner: {
      front: 'Learn the plan with her',
      back: 'Read this week’s cards together, or ask her what she learned at her last appointment. Knowing what’s going on means she doesn’t have to explain everything twice, and you can spot when something changes.',
    },
    thought: {
      front: 'Small and steady is still progress.',
      back: 'Not every week brings something you can see. Quiet weeks matter too. Things are growing exactly at their own pace.',
    },
  },
  11: {
    baby: {
      front: 'Fingers, toes and tiny nails',
      back: 'The baby is about 4cm long. Fingers and toes are separating, and tiny fingernails and ears are forming. The baby is already moving and kicking, though it’s far too early to feel it.',
    },
    body: {
      front: 'Aches around the tummy',
      back: 'Some people notice aches around the lower tummy as the womb grows, plus nausea, tiredness and mood swings. The placenta is gradually taking over hormone production, which can bring ups and downs. Mention any sharp or lasting pain to your midwife or doctor.',
    },
    try: {
      front: 'Snap your first bump photo',
      back: 'Even if there’s no bump yet, take a photo on the Progress tab. Same spot, same pose, every few weeks. You’ll love looking back at the first one later.',
    },
    partner: {
      front: 'Be the photographer',
      back: 'Offer to take the bump photos, same place, same angle, every few weeks. It’s a small ritual you get to own, and it turns into a lovely record for both of you.',
    },
    thought: {
      front: 'Your body knows how to do this.',
      back: 'Trust that a great deal is happening without you having to direct it. You are allowed to simply let it unfold.',
    },
  },
  12: {
    baby: {
      front: 'Fully formed, now just growing',
      back: 'The baby is about 5.4cm long. The organs, muscles, limbs and bones are in place, and the skeleton is starting to harden. From here on, most of the work is growing and maturing.',
    },
    body: {
      front: 'Nausea starting to ease?',
      back: 'For many people, sickness eases around now as hormones settle, and appetite comes back. Indigestion, sore breasts and skin changes can carry on. If sickness is still severe, your midwife or doctor can help.',
    },
    try: {
      front: 'Decide who you’ll tell, and when',
      back: 'There’s no right time to share the news. Talk together about who you’d like to tell first and how. Some people wait until after the first scan; others tell close family early.',
    },
    partner: {
      front: 'Plan how to share the news',
      back: 'Help plan how you’ll tell family and friends, and let her lead on who and when. Offer to make the calls she doesn’t feel up to, or to field the follow-up questions.',
    },
    thought: {
      front: 'You’ve come so far already.',
      back: 'A whole trimester of change, most of it invisible. Take a moment to notice how much you’ve carried, quite literally.',
    },
  },
  13: {
    baby: {
      front: 'Wriggly and active',
      back: 'The baby is about 7.4cm long and moves around a lot, though the movements are jerky and random for now. The ovaries or testes are fully formed inside.',
    },
    body: {
      front: 'New little surprises',
      back: 'Swollen gums, nosebleeds, headaches, constipation, leg cramps and feeling dizzy when standing up quickly are things some people notice now. Brush gently, drink plenty and get up slowly. Ask your midwife or doctor about anything new.',
    },
    try: {
      front: 'Start pelvic floor exercises',
      back: 'Squeezing and holding the pelvic floor muscles a few times a day helps support the bladder and recovery after birth. Your midwife can show you how. Add a daily reminder if it helps.',
    },
    partner: {
      front: 'Look into antenatal classes',
      back: 'Search for antenatal or parenting classes near you, or online ones you could do together. Shortlist two or three and show her, so all she has to do is pick.',
    },
    thought: {
      front: 'Here’s to the next chapter.',
      back: 'The first trimester is nearly behind you. Many people find the next few weeks a little brighter. Whatever this week feels like, you’re doing beautifully.',
    },
  },
  14: {
    baby: {
      front: 'Kicking already, just too small to feel',
      back: 'The baby is about 8.5cm long, and the head is rounder and more in proportion with the body. The baby is kicking and moving around, but it’s still too early for you to feel it.',
    },
    body: {
      front: 'Energy coming back?',
      back: 'Many people find their energy and appetite return around now, and sickness fades. Twinges on the sides of the bump, headaches and darker patches of skin can show up. There’s no need to eat for two; just keep meals balanced.',
    },
    try: {
      front: 'Pick a way to move you enjoy',
      back: 'Walking, swimming, pregnancy yoga or a gentle class: find one you look forward to. Around 150 minutes a week of moderate activity is a common goal, if your midwife or doctor is happy with it.',
    },
    partner: {
      front: 'Join her for the movement',
      back: 'Make the walk or swim a shared thing, a couple of times a week. It’s good for you both, it’s time together, and it makes it easier for her to keep going on low-energy days.',
    },
    thought: {
      front: 'Welcome to the second trimester.',
      back: 'A new stretch begins. Notice what feels lighter this week, and let yourself enjoy it.',
    },
  },
  15: {
    baby: {
      front: 'The baby can hear your heartbeat',
      back: 'The baby is about 10cm long and can now hear sounds, starting with your heartbeat. Eyebrows, eyelashes and a fine, soft hair called lanugo are growing.',
    },
    body: {
      front: 'Itchy skin and new twinges',
      back: 'Some people notice itchy skin as the bump stretches, more vaginal discharge, and twinges on the sides of the bump. Moisturiser and loose cotton clothes can help. Tell your midwife or doctor if itching is intense, or if discharge smells or is sore.',
    },
    try: {
      front: 'Play some music',
      back: 'The baby is starting to hear. Pick a song you love and play it now and then. Some parents find the same song soothing after the birth.',
    },
    partner: {
      front: 'Talk to the bump',
      back: 'Your voice is one of the sounds the baby is starting to hear. Say goodnight to the bump, read a page of something, or just chat. It might feel silly at first. It’s also lovely.',
    },
    thought: {
      front: 'The first sound your baby knows is you.',
      back: 'Your heartbeat is the background music of their whole world right now. You’re already their safe place.',
    },
  },
  16: {
    baby: {
      front: 'Making tiny fists',
      back: 'The baby is about 11.6cm long. The nervous system is maturing, so the baby can make facial movements, curl tiny fists and move their arms and legs, though not in a coordinated way yet.',
    },
    body: {
      front: 'Hello, round ligament',
      back: 'Short, sharp twinges on the sides of the bump are often the ligaments stretching to support the womb. Nosebleeds, bloating and leg cramps can come and go. Changing position slowly can help. Ask your midwife or doctor about pain that doesn’t ease.',
    },
    try: {
      front: 'Set up a calm bedtime',
      back: 'A wind-down routine helps as sleep gets harder: screens off a little earlier, a warm drink, a pillow between the knees. Log sleep on Today for a week to see what helps.',
    },
    partner: {
      front: 'Get the pillows sorted',
      back: 'A pregnancy pillow or a couple of extra pillows can make sleep far more comfortable. Ask what she’d like and sort it this week, so it’s one less thing to think about.',
    },
    thought: {
      front: 'You’re allowed to take up space.',
      back: 'In the bed, on the sofa, in the day’s plans. Your comfort matters, and asking for it is part of caring for both of you.',
    },
  },
  17: {
    baby: {
      front: 'Unique fingerprints are forming',
      back: 'The baby is about 12cm long. They can move their eyes, open and close their mouth, and react to loud noises. Fingernails are growing, and fingerprints all their own are forming.',
    },
    body: {
      front: 'Was that a flutter?',
      back: 'Some people feel the first movements as bubbling, fluttering or rolling, often after a meal or when lying still. Many first notice them somewhere between 16 and 24 weeks, so there’s no rush if you haven’t yet.',
    },
    try: {
      front: 'Think about where to give birth',
      back: 'Hospital, birth centre or home: options vary by place. Ask your midwife or doctor what’s available near you, and note your questions on your next appointment in Bloom.',
    },
    partner: {
      front: 'Look into the birth options',
      back: 'Find out what the local hospital or birth centre offers: tours, parking, visiting rules, how far it is at different times of day. Bring what you find to a chat together, so the choice is easy to make.',
    },
    thought: {
      front: 'No one else has ever been quite like your baby.',
      back: 'Even their fingerprints are their own. Someone completely new is on the way.',
    },
  },
  18: {
    baby: {
      front: 'Practising to swallow',
      back: 'The baby is about 14cm long. Hearing is developing, and the baby is practising swallowing and sucking while wriggling their arms and legs.',
    },
    body: {
      front: 'Fluttering, or just wind?',
      back: 'That gentle fluttering may be the baby, though it’s easy to mistake for wind or bloating at first. Sleep may get trickier as the bump grows. Lying on your side with a pillow behind your back can help.',
    },
    try: {
      front: 'Ask about your mid-pregnancy scan',
      back: 'Many people are offered a detailed scan between about 18 and 21 weeks. Ask when yours is and add it to Appointments, with any questions you’d like to ask.',
    },
    partner: {
      front: 'Make the scan a day out',
      back: 'Plan to come to the scan if you can. Afterwards, do something small together, like a favourite lunch or a walk, whatever the scan shows. It makes the day about the two of you, not just a hospital visit.',
    },
    thought: {
      front: 'Every flutter is a hello.',
      back: 'Whether you’ve felt them yet or not, the baby is busy and growing. Those first little movements are worth waiting for.',
    },
  },
  19: {
    baby: {
      front: 'Teeth growing, layer by layer',
      back: 'The baby is about 15cm long. Behind the first set of teeth, adult teeth are already starting to grow, and the baby is gaining weight steadily from here.',
    },
    body: {
      front: 'Tricky nights',
      back: 'Twinges on the sides of the bump, swollen gums, leg cramps and broken sleep are things some people notice now. Stretching the calves before bed may ease cramps. Mention anything that keeps you awake to your midwife or doctor.',
    },
    try: {
      front: 'Track the bumps and bubbles',
      back: 'When you notice a movement, tap Baby kicks on Today. It’s not about counting yet; it’s a nice way to see when the baby tends to be busy.',
    },
    partner: {
      front: 'Take a night off her plate',
      back: 'Offer her a lie-in or an early night this week, and handle the evening or morning routine yourself. Broken sleep adds up, and a protected night can make the whole week feel easier.',
    },
    thought: {
      front: 'Half-way is closer than you think.',
      back: 'Next week marks around the middle of the journey. Look back at how much you’ve already handled.',
    },
  },
  20: {
    baby: {
      front: 'Half-way there',
      back: 'The baby is about 25cm long, head to toe, and covered in a white, waxy coating called vernix that protects the skin. They kick, punch, turn and suck their thumb, practising for feeding.',
    },
    body: {
      front: 'Stretching in every direction',
      back: 'Twinges on the sides of the bump, leg cramps, swollen ankles, tiredness and stretch marks are common now. Feet up in the evening and comfortable shoes can help. Ask your midwife or doctor which vaccines are offered in pregnancy where you live.',
    },
    try: {
      front: 'Mark the half-way point',
      back: 'Take a half-way bump photo on Progress and write a line about how you feel. Half-way moments are easy to let slip by, and lovely to look back on.',
    },
    partner: {
      front: 'Plan a half-way treat',
      back: 'Mark the milestone: a favourite meal, a small gift, or a letter to her or to the baby. It doesn’t need to be big. It just says you noticed how far she’s come.',
    },
    thought: {
      front: 'Twenty weeks of strength.',
      back: 'Half a pregnancy’s worth of changes, worries, naps and wonder. Be proud of every one of them.',
    },
  },
  21: {
    baby: {
      front: 'Settling into sleep and wake',
      back: 'The baby is about 27cm long and now weighs more than the placenta. Hearing keeps improving, and the baby is starting to have patterns of sleeping and waking.',
    },
    body: {
      front: 'Feeling a bit wobbly?',
      back: 'As the bump grows, your centre of balance shifts, so feeling unsteady is common. The baby may get busy just as you lie down to sleep. Backache and swollen feet can come and go. Supportive shoes and slow turns help.',
    },
    try: {
      front: 'Notice the busy times',
      back: 'You may start noticing when the baby is most active, often in the evening or when you rest. Keep tapping Baby kicks on Today; over time you’ll learn their pattern.',
    },
    partner: {
      front: 'Feel for a kick',
      back: 'When she says the baby’s moving, put your hand on the bump and wait. You might not feel it for a few weeks yet, but keep trying. The first time you do is a moment you’ll remember.',
    },
    thought: {
      front: 'You’re getting to know each other.',
      back: 'The baby’s rhythms are starting to show. Each day you learn a little more about the person you’re carrying.',
    },
  },
  22: {
    baby: {
      front: 'Tasting what you eat',
      back: 'The baby is about 28cm long and practising breathing movements. Taste buds are developing, and flavours from what you eat can reach the baby through the amniotic fluid.',
    },
    body: {
      front: 'Aches and new marks',
      back: 'Stretch marks, twinges, tiredness and some pelvic discomfort are things some people notice now. If pain in the pelvis makes walking or turning in bed hard, tell your midwife or doctor; support is available.',
    },
    try: {
      front: 'Eat the rainbow',
      back: 'Flavours you eat can reach the baby. Try adding one new fruit or vegetable to your meals this week, and log it on Meals.',
    },
    partner: {
      front: 'Cook one new dish together',
      back: 'Pick a simple, colourful recipe and cook it together this week. Shared meals are a nice habit to build before the baby arrives, and you’ll have one more dish you can make on a tired night.',
    },
    thought: {
      front: 'Nourishing yourself nourishes two.',
      back: 'Every meal is a small act of care. It doesn’t have to be perfect to count.',
    },
  },
  23: {
    baby: {
      front: 'Arms and legs in proportion',
      back: 'The baby is about 29cm long. Arms and legs are now in proportion with the body, and the baby is practising breathing and building sleep and wake patterns.',
    },
    body: {
      front: 'Short of breath on the stairs?',
      back: 'As the womb grows and the ribcage expands, some people notice rib pain and feeling breathless. A little leaking from the breasts can happen too. Slow down on stairs and sit tall. Tell your midwife or doctor if breathlessness is sudden or severe.',
    },
    try: {
      front: 'Start a nursery list',
      back: 'Make a simple list of what you’ll need: somewhere safe for the baby to sleep, a car seat, clothes, nappies. Starting early means you can borrow, gift-list or buy slowly.',
    },
    partner: {
      front: 'Own the big-item research',
      back: 'Take on researching the bigger items, like the car seat, cot and pram. Shortlist a few and talk them through together. It’s practical help she’ll really notice.',
    },
    thought: {
      front: 'Every breath is enough.',
      back: 'Even when you feel a bit puffed, you’re carrying everything your baby needs. Slow down and let that be fine.',
    },
  },
  24: {
    baby: {
      front: 'A big developmental milestone',
      back: 'The baby is about 30cm long. The lungs, brain and other organs keep maturing, and the baby is putting on weight week by week. This is a milestone week in development.',
    },
    body: {
      front: 'Hungrier than usual?',
      back: 'More appetite, back and rib aches as ligaments soften, tiredness, headaches and indigestion are common now. If you’re feeling low or anxious most days, tell your midwife or doctor; support for how you feel matters as much as your body.',
    },
    try: {
      front: 'Start a birth preferences note',
      back: 'Jot down what matters to you for the birth: who’ll be with you, pain relief you’d like to know about, what helps you feel calm. It’s a starting point to talk through with your midwife, not a fixed plan.',
    },
    partner: {
      front: 'Learn your role on the day',
      back: 'Read her birth preferences and ask what she’d like you to do: speak up for her, keep visitors away, bring music, handle phone calls. Knowing your role makes the day calmer for both of you.',
    },
    thought: {
      front: 'You get to shape this.',
      back: 'There’s no right way to give birth, only the way that’s right for you. Your wishes matter.',
    },
  },
  25: {
    baby: {
      front: 'Hiccups and somersaults',
      back: 'The baby is about 35cm long and very active. They now make urine, which helps keep the amniotic fluid topped up and at the right temperature. You might feel hiccups as little rhythmic taps.',
    },
    body: {
      front: 'A bit puffy?',
      back: 'Some swelling of the feet and ankles is common. If your face, hands or feet swell suddenly, especially with a bad headache or blurry vision, call your midwife or doctor straight away.',
    },
    try: {
      front: 'Raise your feet',
      back: 'Put your feet up for a while each evening, and try not to stand still for long stretches. Gentle ankle circles help too.',
    },
    partner: {
      front: 'Evening foot rub',
      back: 'A foot or calf rub at the end of the day can ease swelling and is a lovely way to wind down together. Ask what feels good.',
    },
    thought: {
      front: 'Your baby has the hiccups, and that’s adorable.',
      back: 'Those little rhythmic taps are one more sign of someone busy and growing. Enjoy them.',
    },
  },
  26: {
    baby: {
      front: 'Eyes opening for the first time',
      back: 'The baby is about 36cm long, and their eyes are starting to open. Blinking comes next.',
    },
    body: {
      front: 'Forgetful and a bit clumsy?',
      back: 'Tiredness, clumsiness, leg cramps and forgetfulness (often called baby brain) are common now. Lists and phone reminders help. It’s tiredness and a busy mind, nothing more.',
    },
    try: {
      front: 'Ask about vaccines',
      back: 'Some vaccines, like whooping cough, are offered in pregnancy to help protect the baby after birth. Ask your midwife or doctor what’s recommended where you live and when.',
    },
    partner: {
      front: 'Be the second memory',
      back: 'Keep track of the dates, forms and errands this week so she doesn’t have to. Set up shared reminders and quietly handle the follow-ups.',
    },
    thought: {
      front: 'Forget the keys, remember this.',
      back: 'You’re carrying a lot, in every sense. Be gentle with yourself about the small stuff.',
    },
  },
  27: {
    baby: {
      front: 'Filling out',
      back: 'The baby is about 37cm long. The lungs are maturing, and the baby is filling out with a layer of fat as the organs keep developing.',
    },
    body: {
      front: 'Snoring, bloating and backache',
      back: 'Bloating, constipation, tiredness and even snoring are common at the end of the second trimester, along with backache and leg cramps. Fibre, water and gentle movement help.',
    },
    try: {
      front: 'Look back on the trimester',
      back: 'Scroll through your bump photos and Progress charts from the last few months. It’s a good moment to notice how far you’ve come.',
    },
    partner: {
      front: 'Write her a note',
      back: 'Write a short note to her, or to the baby, about the last three months. Leave it somewhere she’ll find it. Words on paper last longer than you think.',
    },
    thought: {
      front: 'Two trimesters done.',
      back: 'One more to go. Whatever the last few months held, you’ve carried it all. That’s something to be proud of.',
    },
  },
  28: {
    baby: {
      front: 'A heartbeat around 140',
      back: 'The baby is about 38cm long, head to heel. Their heart has slowed to around 140 beats a minute, still much faster than yours. From here, it’s mostly growing and getting stronger.',
    },
    body: {
      front: 'The third trimester begins',
      back: 'Heartburn, backache, swollen ankles, nosebleeds and trouble sleeping are things some people notice now. Rest helps with a lot of it. If the baby’s movements ever slow down or change, call your midwife or maternity unit straight away, day or night.',
    },
    try: {
      front: 'Get to know the baby’s pattern',
      back: 'Each baby has their own pattern of movement. Keep tapping Baby kicks on Today so you both learn what’s usual for your baby. You never need to wait to call if something feels different.',
    },
    partner: {
      front: 'Know who to call',
      back: 'Save the midwife and maternity unit numbers in your phone, and check they’re in Profile in Bloom. If she ever says the baby feels quieter than usual, help her call straight away, without waiting to see.',
    },
    thought: {
      front: 'The home stretch starts here.',
      back: 'Three months to go, give or take. You’ve already done so much. Let this last stretch be about rest, nesting and getting ready to meet them.',
    },
  },
  29: {
    baby: {
      front: 'All there, now growing strong',
      back: 'The baby is about 39cm long and fully formed. These last weeks are about the organs maturing and building fat to stay warm after birth.',
    },
    body: {
      front: 'Breathless and up at night',
      back: 'Breathlessness, leg cramps, needing the loo more and broken sleep are common now, along with feeling less steady on your feet. Sleeping on your side with pillows for support is often recommended in the third trimester.',
    },
    try: {
      front: 'Choose your birth partner',
      back: 'Decide who you’d like with you during labour, and maybe a back-up. Share your birth preferences note with them so they know what matters to you.',
    },
    partner: {
      front: 'Get ready to be the birth partner',
      back: 'If you’re her birth partner, read her birth preferences again and ask what she’d like from you. If you can, book an antenatal class together that covers the partner’s role.',
    },
    thought: {
      front: 'You don’t have to do this alone.',
      back: 'Lean on the people around you. Asking for help now is a skill that will serve you well when the baby arrives.',
    },
  },
  30: {
    baby: {
      front: 'Eyes that can focus',
      back: 'The baby is about 40cm long, and their eyes can now focus. Vision will keep developing for months after birth.',
    },
    body: {
      front: 'Strange dreams?',
      back: 'Trouble sleeping and vivid or unsettling dreams are common now, along with backache and swollen feet. Dreams like these are just a busy mind processing a lot. Talk them through if they bother you.',
    },
    try: {
      front: 'Check on your vaccines',
      back: 'If you haven’t already, ask your midwife or doctor about vaccines offered in late pregnancy, like whooping cough and RSV, and when the best time is.',
    },
    partner: {
      front: 'Take over one weekly chore',
      back: 'Pick one regular job that’s getting harder for her, like the laundry or the big shop, and make it yours from now until well after the birth.',
    },
    thought: {
      front: 'Your baby will know your face first.',
      back: 'Those newly focusing eyes will soon look up at you. That moment is getting closer every day.',
    },
  },
  31: {
    baby: {
      front: 'Somersaults and finger-sucking',
      back: 'The baby is about 41cm long and very active: moving around, sucking their fingers and doing the odd somersault. They’re getting plumper and less wrinkled each day.',
    },
    body: {
      front: 'Practice tightenings',
      back: 'Some people feel the bump tighten for 20 to 30 seconds and then relax. These practice contractions, called Braxton Hicks, are usually painless. If they become regular or painful, call your midwife or maternity unit.',
    },
    try: {
      front: 'Try the contraction timer',
      back: 'Open the contraction timer in Bloom and have a quick look, so it’s familiar later. Add your own “when to call” plan from your midwife, in your own words.',
    },
    partner: {
      front: 'Learn the contraction timer',
      back: 'Learn how the timer works now, so on the day you can time contractions while she focuses on breathing. Know where her “when to call” plan is.',
    },
    thought: {
      front: 'Your body is rehearsing.',
      back: 'Every tightening is practice for something extraordinary. You’re more prepared than you feel.',
    },
  },
  32: {
    baby: {
      front: 'Putting on weight',
      back: 'The baby is about 42cm long and fully formed, and now mainly needs to gain weight. Over the coming weeks they’ll add around a kilo of fat, which helps keep them warm after birth.',
    },
    body: {
      front: 'Heavier and more tired',
      back: 'More tiredness, side twinges, backache, swelling and broken sleep are common now. The baby’s movements carry on right up to birth; if you notice them slowing or changing, call your midwife or maternity unit straight away.',
    },
    try: {
      front: 'Finish your birth preferences',
      back: 'Look over your birth preferences note and talk it through at your next appointment. Keep a copy on your phone and one in your bag.',
    },
    partner: {
      front: 'Plan the route',
      back: 'Work out how you’ll get to the hospital or birth centre: the route, a back-up, parking, and the entrance to use at night. Do a practice drive if you can.',
    },
    thought: {
      front: 'Plans are a guide, not a promise.',
      back: 'Births don’t always follow the plan, and that’s fine. What matters is that you’re heard and cared for along the way.',
    },
  },
  33: {
    baby: {
      front: 'Bones hardening, skull still soft',
      back: 'The baby is about 44cm long. The brain and nervous system are fully developed, and the bones are hardening, except the skull, which stays soft to make birth easier.',
    },
    body: {
      front: 'Heaviness low down',
      back: 'Some people feel heaviness in the pelvis as the baby moves into a head-down position, along with Braxton Hicks, tiredness and indigestion. Rest with your feet up when you can.',
    },
    try: {
      front: 'Pack the hospital bag',
      back: 'Start packing a bag for labour and after the birth: comfy clothes, toiletries, snacks, phone charger, baby clothes and nappies. Ask your hospital for their own list too.',
    },
    partner: {
      front: 'Pack your own bag',
      back: 'Pack a small bag for yourself too: snacks, a change of clothes, charger, a power bank, and anything to keep her comfortable. Put the car seat in the car and practise fitting it.',
    },
    thought: {
      front: 'You’re building a nest.',
      back: 'Every little thing you prepare is a welcome for someone you love already.',
    },
  },
  34: {
    baby: {
      front: 'Settling into position',
      back: 'The baby is about 45cm long. Many babies are moving lower into the pelvis around now, getting ready for birth.',
    },
    body: {
      front: 'Breathing a little easier?',
      back: 'When the baby drops lower, there can be less pressure on the lungs and stomach, but more on the bladder, and walking may feel harder. This doesn’t mean labour is about to start.',
    },
    try: {
      front: 'Plan your leave',
      back: 'If you work, think about when you’d like to start your leave and let your workplace know. Leave time to rest before the baby arrives if you can.',
    },
    partner: {
      front: 'Plan your own time off',
      back: 'Sort out your leave for the birth and the first weeks after. Agree with work how you’ll be reached when labour starts, so you can leave quickly.',
    },
    thought: {
      front: 'Slowing down is part of getting ready.',
      back: 'You don’t have to finish every task before the baby comes. Rest is preparation too.',
    },
  },
  35: {
    baby: {
      front: 'Getting chubbier',
      back: 'The baby is about 46cm long and getting rounder, which will help them stay warm after birth.',
    },
    body: {
      front: 'Sore ribs and broken sleep',
      back: 'A little foot under the ribs, Braxton Hicks, trouble sleeping and swollen hands and feet are common now. Sitting upright and stretching gently can ease rib soreness.',
    },
    try: {
      front: 'Learn about pain relief options',
      back: 'Ask your midwife which pain relief options are available where you’ll give birth, from breathing and water to medical options. Knowing them ahead of time makes choices easier on the day.',
    },
    partner: {
      front: 'Practise breathing together',
      back: 'Learn a simple breathing pattern for labour together, like breathing in for four and out for six. Practise for a few minutes in the evening, so you can guide her when it counts.',
    },
    thought: {
      front: 'Breathe in calm, breathe out doubt.',
      back: 'You don’t have to feel brave every moment. You only need to take the next breath.',
    },
  },
  36: {
    baby: {
      front: 'Lungs nearly ready',
      back: 'The baby is about 47cm long. The lungs are likely mature enough to work on their own, and the baby can now suck and digest milk. Many babies are head-down in the pelvis by now.',
    },
    body: {
      front: 'A little leak when you laugh?',
      back: 'Braxton Hicks, broken sleep, backache, swelling, and a little leaking when you cough or laugh are common now. Pelvic floor exercises help. Keep an eye on the baby’s movements, and call straight away if they change.',
    },
    try: {
      front: 'Finish the hospital bag',
      back: 'Add the final bits: your pregnancy notes, birth preferences, phone numbers and chargers. Leave the bag by the door.',
    },
    partner: {
      front: 'Ready the home for coming back',
      back: 'Make the first days home easier: fill the freezer with a few meals, stock up on basics, and set up where the baby will sleep.',
    },
    thought: {
      front: 'Nearly there.',
      back: 'So much of the waiting is behind you. Everything is coming together, one small step at a time.',
    },
  },
  37: {
    baby: {
      front: 'Full term',
      back: 'The baby is about 49cm long and now considered full term. Most babies are head-down, ready for birth.',
    },
    body: {
      front: 'The urge to nest',
      back: 'Some people feel a burst of energy to clean and organise. Heartburn may ease as the baby moves lower, and Braxton Hicks carry on. Nest if it feels good, but rest just as much.',
    },
    try: {
      front: 'Ask about newborn checks',
      back: 'Ask your midwife which checks and screening the baby is offered after birth, so nothing comes as a surprise in those first days.',
    },
    partner: {
      front: 'Know how you’re both doing',
      back: 'Feeling low after a birth can happen to either parent. Learn the signs, like lasting sadness, worry or not feeling like yourself, and agree you’ll both speak up and talk to your midwife or doctor if they appear.',
    },
    thought: {
      front: 'Any day now could be the day.',
      back: 'You’re ready enough. Nobody is ever completely ready, and that’s alright.',
    },
  },
  38: {
    baby: {
      front: 'Getting ready to meet you',
      back: 'The baby is about 50cm long. Most of the soft lanugo hair has gone, and the baby is fully prepared for life outside.',
    },
    body: {
      front: 'Impatient and uncomfortable?',
      back: 'Braxton Hicks, broken sleep, backache, swelling, indigestion and impatience are all common now. Feeling ready to stop being pregnant is completely understandable. Gentle walks and rest can both help.',
    },
    try: {
      front: 'Make a plan for visitors',
      back: 'Decide together who visits in the first days and weeks, and when. Agree a simple message for family, like “we’ll let you know when we’re ready”.',
    },
    partner: {
      front: 'Be the gatekeeper',
      back: 'Handle visitor messages and updates to family so she can rest. Be the one who says “not yet” kindly when you both need space.',
    },
    thought: {
      front: 'The waiting is part of the story.',
      back: 'These last days are their own kind of special. Soon you’ll be holding the person you’ve been waiting for.',
    },
  },
  39: {
    baby: {
      front: 'Wrapped in a protective coat',
      back: 'The baby is about 51cm long, and their skin is covered in a waxy layer called vernix, which helps them on their way out.',
    },
    body: {
      front: 'Signs labour may be getting close',
      back: 'More discharge, backache and pressure low down are common. A “show” of mucus, sometimes streaked with blood, can mean labour is getting closer, though it may still be days. If your waters break, call your midwife or maternity unit straight away.',
    },
    try: {
      front: 'Keep the timer handy',
      back: 'Keep Bloom’s contraction timer one tap away. If tightenings come regularly, time them and follow your “when to call” plan.',
    },
    partner: {
      front: 'Phone charged, bag in the car',
      back: 'Keep your phone charged and with you, and the bags near the door or in the car. Make sure you can be reached at work, and keep fuel in the tank.',
    },
    thought: {
      front: 'You’ve got this, together.',
      back: 'Whatever happens next, you won’t be facing it alone.',
    },
  },
  40: {
    baby: {
      front: 'Due date week',
      back: 'The baby is about 51cm long and ready to meet you. Movements carry on right up to birth, so keep noticing them.',
    },
    body: {
      front: 'Waiting, waiting',
      back: 'Braxton Hicks, trouble sleeping, backache, indigestion and swelling are common now. Lower back pain that comes and goes can be an early sign of labour. Only a small number of babies arrive on the actual due date.',
    },
    try: {
      front: 'Keep your appointment',
      back: 'Your midwife may want to check your blood pressure and urine this week. Keep the appointment, and bring any questions about what happens if the baby doesn’t arrive soon.',
    },
    partner: {
      front: 'Keep spirits up',
      back: 'Plan small, easy distractions: a favourite film, a slow walk, a takeaway. Keep things light and remind her she’s doing an amazing job.',
    },
    thought: {
      front: 'Your baby is coming at their own pace.',
      back: 'A due date is a guess, not a deadline. They’re on their way.',
    },
  },
  41: {
    baby: {
      front: 'Fully ready',
      back: 'The baby is fully mature, often weighing around 3 to 4kg, and just taking their time.',
    },
    body: {
      front: 'Past the due date',
      back: 'Braxton Hicks, poor sleep, backache, swelling and frustration are common now. Your midwife or doctor will talk you through the options from here, including when labour might be started for you.',
    },
    try: {
      front: 'Talk through next steps',
      back: 'Ask your midwife or doctor what happens next and when. Note their answers on your appointment in Bloom so you both have them.',
    },
    partner: {
      front: 'Hold the patience for both of you',
      back: 'Field the “any news?” messages so she doesn’t have to. A shared reply to family can save her dozens of answers each day.',
    },
    thought: {
      front: 'Any day now.',
      back: 'The longest wait is almost over. Soon this will be a story you tell.',
    },
  },
};
