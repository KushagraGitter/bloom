/**
 * The weekly cards: five for each week from 4 to 41, written once and shipped
 * inside the app, so nothing is fetched to show them. Drafted from the NHS
 * week-by-week guide in Bloom’s own words and reviewed in the “Bloom weekly
 * cards” doc. The baby card leaves out the size, which Today already shows.
 *
 * Rules the content test checks: no “normal” or “abnormal”, no “should” or
 * “must”, a short front, and a back of one or two short paragraphs.
 */
import type { WeekCards } from '@/lib/weeklyCards';

export const WEEKLY_CARDS: Record<number, WeekCards> = {
  4: {
    baby: {
      front: 'A tiny new beginning',
      back: 'The embryo has just settled into the lining of the womb. A fluid-filled sac is forming around it, and a small yolk sac feeds it until the placenta can take over. The outer layer of cells has already started building that placenta, which will pass on food and oxygen for the months ahead.\n\nRight now the embryo is a tiny cluster of cells, far too small to see or feel. These first weeks are mostly about laying foundations. You may only just have had a positive test, and that is a perfectly good place to start.',
    },
    body: {
      front: 'Tired, tender, or nothing at all?',
      back: 'Some people notice sore breasts, tiredness, a stronger sense of smell, a metallic taste or a little nausea. Others notice nothing yet, and that is fine too. These early changes come from pregnancy hormones rising quickly.\n\nRest when you can and keep plain snacks handy for wobbly moments. Tell your midwife or doctor if you have bleeding, pain low in your tummy, especially on one side, or pain in the tip of your shoulder. Anything else on your mind is worth asking about too.',
    },
    try: {
      front: 'Start a daily folic acid habit',
      back: 'Folic acid supports the baby’s brain and spine as they form in these early weeks. The usual advice is 400 micrograms a day until 12 weeks, and some people are offered a higher dose, so it’s worth asking your doctor or pharmacist which one suits you.\n\nMany pregnancy vitamins also include vitamin D. Once you’ve chosen one, add it on the Vitamins tab so Bloom can remind you each day. Taking it at the same time, like with breakfast or brushing your teeth, makes it easier to remember.',
    },
    partner: {
      front: 'Be the calm in the big news',
      back: 'Big news brings big feelings: excited, anxious, or both in the same hour. Ask how she’s feeling today and just listen, without rushing to fix anything. She may also be very tired already, even though nothing shows yet.\n\nTake one job off her list, like cooking tonight or making the first call to book with a midwife or GP. Small, steady help like this tells her she isn’t carrying the planning alone, which matters as much as the task itself.',
    },
    thought: {
      front: 'Something wonderful has quietly begun.',
      back: 'You don’t need to feel ready or know everything. You only need to take today as it comes.\n\nThe rest will unfold one week at a time, with people around you to ask, and you won’t be doing any of it alone.',
    },
  },
  5: {
    baby: {
      front: 'The heart is starting to form',
      back: 'The neural tube, which will become the brain and spinal cord, is forming fast. The tiny heart is taking shape too, as a simple tube that will soon begin to beat. Everything is still only about 2mm long.\n\nBlood vessels and the first blood cells are also starting to appear. It is far too early to see much on a scan, but the basic outline of a whole person is being drawn this week, which is why folic acid matters so much right now.',
    },
    body: {
      front: 'Wiped out by lunchtime?',
      back: 'Deep tiredness, nausea, a metallic taste, needing the loo more and mood swings are things some people notice now. They come from rising hormones and your body putting energy into early growth. Light spotting can happen too.\n\nSmall, frequent meals and sipping water through the day help some people. Tell your midwife or doctor about any bleeding, tummy pain, pain on one side, shoulder tip pain, or a burning feeling when you wee, so they can check things over.',
    },
    try: {
      front: 'Book the first appointment',
      back: 'Call your midwife, GP surgery or doctor to set up your first pregnancy appointment, often called the booking appointment. It’s usually best booked early, as it often takes place before 10 weeks and can lead to blood tests and scan dates.\n\nOnce it’s booked, add it to Appointments in Bloom so you both get a reminder. Use the notes on the appointment to jot down questions as they come to you, like medicines you take or anything from past pregnancies or family health.',
    },
    partner: {
      front: 'Stock a nausea kit',
      back: 'Put together a small kit: plain crackers, ginger biscuits or ginger tea, a water bottle and some mints. Leave one by the bed and one in her bag, and refill them without being asked.\n\nNibbling something plain before getting up can make mornings easier for some people. If she’s struggling to keep anything down, offer to make the call to the midwife or doctor. Little things that are simply there can turn a rough morning into a manageable one.',
    },
    thought: {
      front: 'Rest is productive right now.',
      back: 'Your body is doing huge, invisible work.\n\nIf you need an early night, a nap or a slower day, that is part of the job, not a break from it. You’re allowed to put yourself first this week.',
    },
  },
  6: {
    baby: {
      front: 'Arms, legs and ears begin',
      back: 'Small buds that will become arms and legs are appearing, and the ears are starting to form. The heart is now beating, and it can sometimes be seen flickering on an early internal scan. Curled up, the embryo is now about 6mm long.\n\nThe brain keeps developing quickly, and the face is starting to take shape. These limb buds are the very beginning of the hands and feet you’ll eventually feel pushing against you, many weeks from now.',
    },
    body: {
      front: 'Smells suddenly too strong?',
      back: 'A sharper sense of smell, sickness at any time of day, tiredness and tender breasts are common now. Hormones are at work, and nausea often peaks over the next few weeks before easing for many people.\n\nFresh air, cold foods and avoiding cooking smells can help. If you can’t keep food or drinks down for a day, are weeing very little, feel faint, or have bleeding or tummy pain, call your midwife or doctor. Severe sickness can be treated.',
    },
    try: {
      front: 'Log how you feel, once a day',
      back: 'Open Mood & symptoms and note how today went, even in one word. It only takes a moment, and over the weeks it builds a picture you can bring to appointments.\n\nIt also helps you spot patterns, like which times of day or which foods feel better. If sickness or low mood starts to feel like a lot, your notes make it easier to explain to your midwife or doctor exactly what’s been happening.',
    },
    partner: {
      front: 'Take over the kitchen smells',
      back: 'If cooking smells are hard for her right now, take over the cooking or keep it simple: cold meals, open windows, the bin emptied often. Strong smells can set off nausea even when she feels fine a moment before.\n\nAsk which smells are worst this week, as they may change. Keep your own aftershave or strong foods low-key for a while. It’s a small adjustment for you, and it can make home feel like a place she can rest.',
    },
    thought: {
      front: 'One day at a time is enough.',
      back: 'Some days will feel lovely and some will feel like a slog. Both are part of this.\n\nYou’re allowed to find it hard and still be happy about it. Feeling rough doesn’t mean you’re doing it wrong.',
    },
  },
  7: {
    baby: {
      front: '100 new brain cells a minute',
      back: 'The brain is growing fast, making around 100 new cells every minute. The limb buds are lengthening and the eyelids are starting to form. The embryo is now about 1cm long.\n\nThe inner ear and the beginnings of the nose and mouth are developing too. The baby is still curled with a small tail-like shape that will disappear over the coming weeks. None of this can be felt yet, but a lot is being built.',
    },
    body: {
      front: 'Changes you can’t see yet',
      back: 'Nausea, tiredness, mood swings and sore breasts often carry on this week. Some people notice darker patches of skin, more vaginal discharge, or needing to wee more as the womb grows and blood flow increases.\n\nGentle movement like a short walk can lift energy, even when it’s the last thing you feel like. Tell your midwife or doctor about bleeding, cramping pain, discharge that smells or itches, or pain or stinging when you wee.',
    },
    try: {
      front: 'Take a 10-minute walk',
      back: 'If you feel up to it, a short walk in fresh air can ease nausea, lift your mood and help with sleep. Staying active in a gentle way suits most people in pregnancy.\n\nStart small, at a pace where you can still chat. If you exercised before, you can usually keep going at a comfortable level, but it’s worth checking with your midwife or doctor about what’s right for you. On rough days, a few minutes by an open window counts too.',
    },
    partner: {
      front: 'Plan a low-key date',
      back: 'Plan something easy together that doesn’t revolve around food or late nights: a film at home, a slow walk, a favourite show. Let her choose, or offer two simple options.\n\nThe point is time for the two of you, not a big event. Early pregnancy can feel oddly lonely because nothing shows yet and few people know. Making space just for the two of you reminds her she’s sharing this with someone.',
    },
    thought: {
      front: 'You are already caring for your baby.',
      back: 'Every glass of water, every rest and every vitamin is care.\n\nLong before anyone can see a bump, you are already looking after someone, simply by looking after yourself. That counts on the days you manage very little, too. Resting, eating what you can and asking for help are all ways of caring for both of you.',
    },
  },
  8: {
    baby: {
      front: 'Little arms and legs are growing',
      back: 'The baby is about 16mm long. The head is starting to uncurl, the arms are getting longer and the legs are developing, though the knees and ankles haven’t formed yet.\n\nFingers and toes are beginning to appear as small ridges, and the baby is starting to make tiny movements you won’t feel for many weeks. The heart keeps beating fast and steadily. By the end of next month, most of the main body parts will be in place.',
    },
    body: {
      front: 'Bloated and ready for a nap?',
      back: 'Tiredness, nausea, bloating, needing to wee more and tender breasts are common around now. Hormones slow digestion, which can bring wind and bloating, and the growing womb presses on your bladder.\n\nComfortable clothes, small meals and an earlier bedtime can help. A well-fitting, supportive bra may ease sore breasts, and loose waistbands can help with bloating. Call your midwife or doctor about bleeding, tummy pain, a high temperature, or anything that feels off to you.',
    },
    try: {
      front: 'Start a questions list',
      back: 'Before the first appointment, write down what you want to ask: what to eat and avoid, which medicines are fine, when the first scan is, and what tests you’ll be offered.\n\nAdd them as notes on the appointment in Bloom so neither of you forgets. Appointments can feel quick, and it’s easy to blank in the moment, so add new questions whenever they pop up. Having a list means you leave with answers, not just more questions.',
    },
    partner: {
      front: 'Come to the first appointment',
      back: 'If you can, go along to the first appointment. It can be long, with lots of questions about health and family history, so your memory may help too.\n\nTake notes, hold the questions list and ask your own questions. Hearing the advice first-hand means she doesn’t have to repeat it all later. Being there for the early visits shows her you’re in this from the start, which can mean a lot.',
    },
    thought: {
      front: 'Your feelings make sense.',
      back: 'Joy, worry, tiredness and wonder can all show up on the same day. None of them cancels the others.\n\nBe as kind to yourself as you would be to a friend going through the same thing. You don’t have to pick one feeling or have it all worked out. There’s room for every part of how you feel this week.',
    },
  },
  9: {
    baby: {
      front: 'A little face is appearing',
      back: 'The baby now has a recognisable face, with eyes and eyelids, a mouth, and a tongue with tiny taste buds. The heart, brain, lungs, kidneys and gut are all forming, and the first bones are starting to develop.\n\nThe hands and feet are taking shape with little ridges where fingers and toes will be. Muscles are starting to develop too, and the baby makes small, jerky movements, though these are far too tiny to feel for now.',
    },
    body: {
      front: 'Clothes feeling snug?',
      back: 'Some people notice their waist thickening and breasts growing. Tiredness, nausea, headaches and mood swings can still be around, as your blood volume rises and hormones keep shifting.\n\nDrinking water steadily through the day and resting when you can may help. Ask a pharmacist, midwife or doctor before taking any medicine, including ones you’ve used before. Tell them about bleeding, tummy pain, or headaches that won’t settle, or if you feel very low or anxious.',
    },
    try: {
      front: 'Ask when your first scan is',
      back: 'The first scan, often called the dating scan, is usually offered between about 10 and 14 weeks. It checks how the baby is growing and gives you a due date.\n\nAsk your midwife or doctor when yours will be, then add it to Appointments so it’s on both phones. You may also be offered screening tests around the same time, so it’s worth asking what they involve, and taking time to decide what feels right for you.',
    },
    partner: {
      front: 'Ask, don’t guess',
      back: 'Instead of guessing what would help, ask a simple question: “What would make today easier?” The answer might be tiny, like a hot water bottle, a lift somewhere or quiet time.\n\nDoing that one thing well beats doing ten things she didn’t need. It also takes away the effort of having to ask for help, which can be tiring in itself when she already feels unwell. Ask again tomorrow, as the answer may change.',
    },
    thought: {
      front: 'You’re growing someone’s very first smile.',
      back: 'Somewhere in there, a face is taking shape that you’ll one day know by heart.\n\nThat’s worth a moment of wonder today, however tired or queasy you feel. You don’t have to feel glowing to be doing something remarkable. Getting through the day as you are is more than enough.',
    },
  },
  10: {
    baby: {
      front: 'A heartbeat racing at 180',
      back: 'The heart is beating very fast, around 180 beats a minute. The face is filling out, with ears, nostrils and a delicate upper lip forming. The baby is about 3cm long from head to bottom.\n\nThe embryo is now becoming a fetus, and the tail-like shape has gone. The kidneys are starting to work, and tiny limbs can bend at the elbows. If you have a scan soon, you may see the baby move.',
    },
    body: {
      front: 'Heartburn has entered the chat',
      back: 'Pregnancy hormones relax the muscles of the gut, so heartburn and bloating are common now, along with tiredness and nausea. Some people also notice more veins showing on their tummy and breasts.\n\nSmaller meals and not lying down straight after eating can help, and so can propping up your pillows. Your pharmacist can suggest what’s safe to take. Tell your midwife or doctor about bleeding, tummy pain, or sickness that stops you keeping fluids down.',
    },
    try: {
      front: 'Check in on vitamin D',
      back: 'Vitamin D helps your body use calcium, which supports the baby’s bones and teeth. In the UK, the usual advice is 10 micrograms a day in pregnancy, especially from autumn to spring, when there’s less sunlight.\n\nCheck whether your pregnancy vitamin already includes it, and ask your midwife or doctor if you’re unsure. If you take it separately, add it on the Vitamins tab so it gets its own reminder alongside folic acid.',
    },
    partner: {
      front: 'Learn the plan with her',
      back: 'Read this week’s cards together, or ask her what she learned at her last appointment. Find out when the first scan is and whether she’d like you there.\n\nKnowing what’s going on means she doesn’t have to explain everything twice, and you can spot when something changes. It also means you can share the decisions about tests and screening, instead of leaving her to research them alone. Ask what questions she’d like you to help with.',
    },
    thought: {
      front: 'Small and steady is still progress.',
      back: 'Not every week brings something you can see. Quiet weeks matter too.\n\nThings are growing at their own pace, and so are you. Getting through an ordinary day is still something, and you’re allowed to feel proud of it. There’s no need to rush ahead or measure yourself against anyone else.',
    },
  },
  11: {
    baby: {
      front: 'Fingers, toes and tiny nails',
      back: 'The baby is about 4cm long. Fingers and toes are separating, and tiny fingernails and ears are forming. The baby is already moving and kicking, though it’s far too early to feel it.\n\nThe head is still large compared with the body, and the bones are slowly starting to harden. Those early kicks will get stronger, and somewhere around 16 to 24 weeks you may start to notice them as little flutters.',
    },
    body: {
      front: 'Aches around the tummy',
      back: 'Some people notice aches around the lower tummy as the womb grows and stretches, plus nausea, tiredness and mood swings. The placenta is gradually taking over hormone production, which can bring ups and downs.\n\nA warm bath, rest or changing position can ease mild aches. Tell your midwife or doctor about any sharp, cramping or lasting pain, bleeding, or pain when you wee, so they can check it. Mood changes are worth mentioning too.',
    },
    try: {
      front: 'Snap your first bump photo',
      back: 'Even if there’s no bump yet, take a photo on the Progress tab. It’s the starting point that makes the later photos so satisfying to look back on.\n\nPick one spot with good light, stand side-on and use the same pose each time. Taking one every two to four weeks is plenty. You can log your weight on Progress too if you’d like, but there’s no pressure to. Some people prefer to skip weighing altogether, and that’s fine.',
    },
    partner: {
      front: 'Be the photographer',
      back: 'Offer to take the bump photos, same place, same angle, every few weeks. Agree on a spot and a pose, and remind her gently when it’s time.\n\nIt’s a small ritual you get to own, and it turns into a lovely record for both of you. If she doesn’t feel like it one week, skip it with no fuss. The aim is a nice memory, not a chore, so keep it light and fun.',
    },
    thought: {
      front: 'Your body knows how to do this.',
      back: 'Trust that a great deal is happening without you having to direct it.\n\nYou are allowed to simply let it unfold, and to rest while it does. You don’t have to understand every change or get everything right. Looking after yourself kindly is already doing your part, and it’s plenty.',
    },
  },
  12: {
    baby: {
      front: 'Fully formed, now just growing',
      back: 'The baby is about 5.4cm long. The organs, muscles, limbs and bones are in place, and the skeleton is starting to harden. From here on, most of the work is growing and maturing.\n\nThe baby can open and close its hands and may be moving around quite a lot inside the fluid. If you have your dating scan around now, you may see these movements on screen, even though you can’t feel them yet.',
    },
    body: {
      front: 'Nausea starting to ease?',
      back: 'For many people, sickness eases around now as hormones settle, and appetite comes back. Indigestion, sore breasts and skin changes can carry on, and you may still feel more tired than usual.\n\nSmall meals and staying upright after eating can help with indigestion. If sickness is still severe, or you can’t keep fluids down, your midwife or doctor can help, as there are treatments. Tell them about any bleeding or pain too.',
    },
    try: {
      front: 'Decide who you’ll tell, and when',
      back: 'There’s no right time to share the news. Talk together about who you’d like to tell first and how, in person, on a call or another way.\n\nSome people wait until after the first scan; others tell close family early so they have support. It’s also worth thinking about work, as telling your employer lets you take paid time off for antenatal appointments. Go at the pace that feels right for you.',
    },
    partner: {
      front: 'Plan how to share the news',
      back: 'Help plan how you’ll tell family and friends, and let her lead on who and when. Talk about what you’d each like to keep private for now.\n\nOffer to make the calls she doesn’t feel up to, or to field the follow-up questions and advice that often come with them. Taking on that part lets her enjoy the moments of sharing without it becoming one more thing to manage. Keep her in the loop on who knows.',
    },
    thought: {
      front: 'You’ve come so far already.',
      back: 'A whole trimester of change, most of it invisible.\n\nTake a moment to notice how much you’ve carried, quite literally, and how gently you’ve got yourself through it. The tiredness, the queasy mornings and the waiting all took strength, even when it didn’t feel like it. You did that.',
    },
  },
  13: {
    baby: {
      front: 'Wriggly and active',
      back: 'The baby is about 7.4cm long and moves around a lot, though the movements are jerky and random for now. The ovaries or testes are fully formed inside.\n\nThe baby can now swallow small amounts of the fluid around it, practising for feeding later. The bones keep hardening, and the body is starting to catch up with the head. These busy movements are still too small to feel, but they’re building strength.',
    },
    body: {
      front: 'New little surprises',
      back: 'Swollen or bleeding gums, nosebleeds, headaches, constipation, leg cramps and feeling dizzy when standing up quickly are things some people notice now. Hormones and a rise in blood volume are behind many of these.\n\nBrush gently, drink plenty, eat fibre-rich food and get up slowly. NHS dental care is free in pregnancy in the UK, so it’s a good time to see a dentist. Tell your midwife or doctor about bleeding, pain, or anything new.',
    },
    try: {
      front: 'Start pelvic floor exercises',
      back: 'Your pelvic floor muscles support the bladder, bowel and womb. Strengthening them now can help with leaks later in pregnancy and with recovery after birth.\n\nSqueeze the muscles you’d use to stop a wee, hold for a few seconds, then relax. Try 10 slow squeezes, a few times a day, while breathing as usual. Your midwife can check you’re doing it right. A daily reminder in Bloom can help it stick.',
    },
    partner: {
      front: 'Look into antenatal classes',
      back: 'Search for antenatal or parenting classes near you, or online ones you could do together. Ask the midwife about free NHS classes too, as they’re often worth booking early.\n\nShortlist two or three and show her, so all she has to do is pick. Classes help partners feel ready for labour and the early days, and going together means you’ll both have the same plan when the time comes. You’ll probably meet other parents too.',
    },
    thought: {
      front: 'Here’s to the next chapter.',
      back: 'The first trimester is nearly behind you. Many people find the next few weeks a little brighter.\n\nWhatever this week feels like, you’re doing beautifully, and every step so far has counted. There’s no right way to feel about reaching this point. Take a breath and enjoy being here.',
    },
  },
  14: {
    baby: {
      front: 'Kicking already, just too small to feel',
      back: 'The baby is about 8.5cm long, and the head is rounder and more in proportion with the body. The baby is kicking, stretching and moving around in the fluid, but is still far too small for you to feel any of it.\n\nTheir body is now growing faster than their head, so the proportions look more like a newborn’s each week. The muscles in the face are working too, and tiny movements of the mouth and eyes are starting. Most people feel the first movements somewhere between 16 and 24 weeks, so there’s plenty of time.',
    },
    body: {
      front: 'Energy coming back?',
      back: 'Many people find their energy and appetite return around now, and sickness fades as hormone levels settle. Twinges on the sides of the bump, headaches and darker patches of skin on the face can show up. The patches come from pregnancy hormones and usually fade after the birth.\n\nThere’s no need to eat for two; balanced meals and regular snacks are plenty. Sunscreen can stop dark patches getting darker, and water and rest help headaches. Tell your midwife or doctor about any bleeding, tummy pain that doesn’t ease, or a headache that’s severe or won’t go away.',
    },
    try: {
      front: 'Pick a way to move you enjoy',
      back: 'Walking, swimming, pregnancy yoga or a gentle class: find one you look forward to. Around 150 minutes a week of moderate activity is a common goal, if your midwife or doctor is happy with it. That could be 30 minutes on five days.\n\nMoving regularly can help with sleep, mood, backache and energy, and it keeps you strong for the months ahead. A good guide is that you can still hold a conversation while you exercise. Start small if you weren’t active before, skip contact sports, and stop and rest if anything hurts or you feel dizzy.',
    },
    partner: {
      front: 'Join her for the movement',
      back: 'Make the walk or swim a shared thing, a couple of times a week. Pick a time that suits her energy, maybe a short walk after dinner or a weekend swim, and put it in both your calendars so it happens without anyone having to ask.\n\nLet her set the pace and keep it relaxed, carrying the water and snacks yourself. It’s good for you both, it’s time together without screens, and it makes it much easier for her to keep going on the days when her energy is low.',
    },
    thought: {
      front: 'Welcome to the second trimester.',
      back: 'A new stretch begins, and for many people it’s a gentler one. Notice what feels lighter this week, whether that’s an easier morning or a meal you actually enjoyed.\n\nLet yourself enjoy it. You’ve come through the first three months, and that took more than anyone could see.',
    },
  },
  15: {
    baby: {
      front: 'The baby can hear your heartbeat',
      back: 'The baby is about 10cm long and can now hear sounds, starting with your heartbeat and the gurgles of your digestion. Eyebrows, eyelashes and a fine, soft hair called lanugo are growing over the skin.\n\nThe lanugo helps keep the baby warm and usually disappears before birth or soon after. The baby is also moving their arms and legs more, and the bones are slowly getting harder. You won’t feel the movements just yet, but each week brings you closer.',
    },
    body: {
      front: 'Itchy skin and new twinges',
      back: 'Some people notice itchy skin as the bump stretches, more vaginal discharge, and twinges on the sides of the bump. The extra discharge helps protect against infection, and the twinges are usually ligaments stretching as your womb grows.\n\nUnperfumed moisturiser, cool showers and loose cotton clothes can help. Tell your midwife or doctor if itching is intense, especially on your hands and feet or at night, as it can be a sign of a liver condition that needs checking. Mention it too if discharge smells, is itchy, or feels sore.',
    },
    try: {
      front: 'Play some music',
      back: 'The baby is starting to hear. Pick a song you love and play it now and then, at a comfortable volume through speakers rather than headphones on the bump.\n\nThere’s nothing to achieve here; it’s just a gentle way to feel connected while you wait for the first movements. Some parents find the same song soothing for the baby after the birth, so it’s worth picking one you won’t mind hearing a hundred times. A short playlist you both choose can be a nice shared project.',
    },
    partner: {
      front: 'Talk to the bump',
      back: 'Your voice is one of the sounds the baby is starting to hear, and over the coming weeks they’ll get used to it. Say goodnight to the bump, read a page of something, or just tell the baby about your day.\n\nIt might feel silly at first, and that’s fine. Doing it while she’s resting, with a hand on the bump, makes it a calm moment for you both. Babies often recognise familiar voices after birth, so the time you spend now is a small head start on getting to know each other.',
    },
    thought: {
      front: 'The first sound your baby knows is you.',
      back: 'Your heartbeat is the background music of their whole world right now, steady through the day and the night.\n\nYou’re already their safe place, just by being here. Nothing extra is asked of you for that to be true.',
    },
  },
  16: {
    baby: {
      front: 'Making tiny fists',
      back: 'The baby is about 11.6cm long. The nervous system is maturing, so the baby can make facial movements like frowning and squinting, curl tiny fists and move their arms and legs, though not in a coordinated way yet.\n\nMuscles are getting stronger and the back is straightening out. Some people start to feel the first faint movements around now, often described as bubbles or a light flutter low in the bump. If you haven’t noticed anything yet, that’s very common, especially in a first pregnancy.',
    },
    body: {
      front: 'Hello, round ligament',
      back: 'Short, sharp twinges on the sides of the bump are often the ligaments stretching to support the womb. Nosebleeds and bleeding gums can happen because of extra blood flow, and bloating and leg cramps can come and go.\n\nChanging position slowly, a warm bath and gentle stretches can help. A soft toothbrush helps sore gums, and free NHS dental care in pregnancy makes a check-up worth booking. Ask your midwife or doctor about pain that doesn’t ease, or tell them straight away about any bleeding from the vagina.',
    },
    try: {
      front: 'Set up a calm bedtime',
      back: 'A wind-down routine helps as sleep gets harder: screens off a little earlier, a warm drink, a pillow between the knees. Going to bed at a similar time each night helps your body know when to switch off.\n\nLying on your side can feel more comfortable as the bump grows, and it’s a good habit to start now. Log sleep on Today for a week to see what helps and what doesn’t. If worry keeps you awake, writing it down before bed can quieten your mind.',
    },
    partner: {
      front: 'Get the pillows sorted',
      back: 'A pregnancy pillow or a couple of extra pillows can make sleep far more comfortable, supporting her bump, back and knees. Ask what she’d like, whether that’s one long pillow or a few small ones, and sort it this week.\n\nIt might mean rearranging the bed a little, or taking a smaller share of the duvet. It’s a small, practical thing, but it’s one less thing for her to think about, and better sleep makes everything else in the day feel more manageable.',
    },
    thought: {
      front: 'You’re allowed to take up space.',
      back: 'In the bed, on the sofa, in the day’s plans. Your comfort matters, and asking for it is part of caring for both of you.\n\nYou don’t have to earn rest or explain why you need an extra pillow. Saying what helps is a strength, not a fuss.',
    },
  },
  17: {
    baby: {
      front: 'Unique fingerprints are forming',
      back: 'The baby is about 12cm long. They can move their eyes, open and close their mouth, and react to loud noises from outside. Fingernails are growing, and fingerprints all their own are forming on the tips of their fingers.\n\nThe baby is also starting to build up a little fat under the skin, which will help keep them warm after birth. Their movements are getting stronger, and some people begin to notice them as faint flutters. If you haven’t, there’s still plenty of time.',
    },
    body: {
      front: 'Was that a flutter?',
      back: 'Some people feel the first movements as bubbling, fluttering or rolling, often after a meal or when lying still. Many first notice them somewhere between 16 and 24 weeks, and it can be later in a first pregnancy, so there’s no rush if you haven’t yet.\n\nLying quietly on your side for a while can make it easier to notice. You may also feel aches in your back or the sides of the bump as you grow. Tell your midwife or doctor about any bleeding, severe tummy pain, or fluid leaking from the vagina.',
    },
    try: {
      front: 'Think about where to give birth',
      back: 'Hospital, birth centre or home: options vary by place, and you can change your mind later. Ask your midwife or doctor what’s available near you, and what might suit you given your health and pregnancy so far.\n\nThinking about it early gives you time to visit, ask questions and talk it over without pressure. Note your questions on your next appointment in Bloom so you have them to hand. Useful ones include pain relief options, who can be with you, and how far away each place is.',
    },
    partner: {
      front: 'Look into the birth options',
      back: 'Find out what the local hospital or birth centre offers: tours, parking, visiting rules, and how long the journey takes at different times of day, including at night. Many units post virtual tours online.\n\nBring what you find to a chat together, so the choice is easy to make and she isn’t doing the research alone. Let her lead the decision, as it’s her body and her comfort that matter most here. Doing the groundwork shows you’re in this together.',
    },
    thought: {
      front: 'No one else has ever been quite like your baby.',
      back: 'Even their fingerprints are their own, being shaped right now, inside you, without you having to do a thing.\n\nSomeone completely new is on the way, and you’re the one making space for them, week after week. That’s quite something.',
    },
  },
  18: {
    baby: {
      front: 'Practising to swallow',
      back: 'The baby is about 14cm long. Hearing is developing, and the baby is practising swallowing and sucking while wriggling their arms and legs. They may hear sounds from outside, like voices and music.\n\nThe baby is moving a lot, and those movements are getting easier to feel. They can be faint and come and go, so you might feel something one day and nothing the next. That’s very common at this stage, as the baby is still small and has plenty of room.',
    },
    body: {
      front: 'Fluttering, or just wind?',
      back: 'That gentle fluttering may be the baby, though it’s easy to mistake for wind or bloating at first. Sleep may get trickier as the bump grows, and you might feel a bit dizzy if you stand up quickly.\n\nLying on your side with a pillow behind your back and one between your knees can help. Get up slowly and keep water close. Tell your midwife or doctor about any bleeding, severe pain, fainting, or a fever, so they can check things over.',
    },
    try: {
      front: 'Ask about your mid-pregnancy scan',
      back: 'Many people are offered a detailed scan between about 18 and 21 weeks, which checks how the baby is growing and looks closely at the baby’s body. Ask when yours is and add it to Appointments, with any questions you’d like to ask.\n\nYou can usually bring someone with you. Some hospitals can tell you the baby’s sex if you’d like to know, but not all do, so it’s worth asking ahead. After the scan, add any letter or report to Reports so it’s easy to find later.',
    },
    partner: {
      front: 'Make the scan a day out',
      back: 'Plan to come to the scan if you can, and book the time off work early. Offer to sort the travel and parking, and bring a drink and a snack, as waits can be long.\n\nAfterwards, do something small together, like a favourite lunch or a walk, whatever the scan shows. If there’s news that needs more checks, being there means she isn’t hearing it alone. It makes the day about the two of you, not just a hospital visit.',
    },
    thought: {
      front: 'Every flutter is a hello.',
      back: 'Whether you’ve felt them yet or not, the baby is busy and growing.\n\nThose first little movements are worth waiting for, and there’s no prize for feeling them early. They’ll find you when they’re ready, and you’ll know them when they do.',
    },
  },
  19: {
    baby: {
      front: 'Teeth growing, layer by layer',
      back: 'The baby is about 15cm long. Behind the first set of teeth, adult teeth are already starting to grow, and the baby is gaining weight steadily from here.\n\nThe baby’s movements are getting stronger, and they’re now moving between periods of activity and rest. If you’ve started to feel them, you might notice they’re busier at certain times of day. If not, that’s still very common at 19 weeks, especially in a first pregnancy.',
    },
    body: {
      front: 'Tricky nights',
      back: 'Twinges on the sides of the bump, swollen gums, leg cramps and broken sleep are things some people notice now. Cramps often come at night and can be sharp, but usually pass after a minute or two.\n\nStretching the calves before bed and moving your feet up and down can ease cramps. A soft toothbrush helps gums, and a dental check-up is free in pregnancy on the NHS. Mention anything that keeps you awake to your midwife or doctor, and tell them about any bleeding or severe pain.',
    },
    try: {
      front: 'Track the bumps and bubbles',
      back: 'When you notice a movement, tap Baby kicks on Today. It’s not about counting yet; it’s a nice way to see when the baby tends to be busy.\n\nOver a few weeks, you’ll start to see a rough pattern, maybe more after meals or in the evening. Getting to know that pattern now helps later, from about 24 weeks, when noticing a change in movements matters more. It’s also a lovely record to look back on.',
    },
    partner: {
      front: 'Take a night off her plate',
      back: 'Offer her a lie-in or an early night this week, and handle the evening or morning routine yourself, including dinner, washing up or any pets. Tell her it’s sorted so she doesn’t have to plan around it.\n\nIf she wakes with cramps, gently stretching her calf by flexing her foot can help. Broken sleep adds up, and a protected night can make the whole week feel easier. It also shows her you’re noticing what she’s carrying, day and night.',
    },
    thought: {
      front: 'Half-way is closer than you think.',
      back: 'Next week marks around the middle of the journey.\n\nLook back at how much you’ve already handled: the tiredness, the appointments, the waiting. You did all of it, often without anyone seeing, and you’re still here, still going. That counts.',
    },
  },
  20: {
    baby: {
      front: 'Half-way there',
      back: 'The baby is about 25cm long, head to toe, and covered in a white, waxy coating called vernix that protects the skin from the fluid around them. They kick, punch, turn and suck their thumb, practising for feeding.\n\nFrom now on, the baby is measured from head to heel rather than head to bottom, which is why the length jumps this week. Their movements are getting stronger, and many people feel them clearly by now, though it can still take a few more weeks.',
    },
    body: {
      front: 'Stretching in every direction',
      back: 'Twinges on the sides of the bump, leg cramps, swollen ankles, tiredness and stretch marks are common now. Stretch marks come from skin stretching quickly and often fade to silvery lines after the birth.\n\nFeet up in the evening and comfortable shoes can help. Ask your midwife or doctor which vaccines are offered in pregnancy where you live. Tell them straight away about any bleeding, severe pain, or sudden swelling of the face, hands or feet.',
    },
    try: {
      front: 'Mark the half-way point',
      back: 'Take a half-way bump photo on Progress and write a line about how you feel. Standing in the same spot with the same light each time makes the changes easy to see later.\n\nHalf-way moments are easy to let slip by, and lovely to look back on. You could add your weight if you’re tracking it, or a note about what’s been hard and what’s been good. It doesn’t have to be polished; honest is better.',
    },
    partner: {
      front: 'Plan a half-way treat',
      back: 'Mark the milestone: a favourite meal, a small gift, or a letter to her or to the baby. Think about what she’d enjoy most right now, such as a quiet night in, a trip out, or a long bath while you cook.\n\nIt doesn’t need to be big or expensive. Plan it yourself so it’s a surprise and not one more job for her. It just says you noticed how far she’s come, and that you’re glad to be on this journey with her.',
    },
    thought: {
      front: 'Twenty weeks of strength.',
      back: 'Half a pregnancy’s worth of changes, worries, naps and wonder.\n\nBe proud of every one of them. You’ve grown a whole person half-way, and you’ve kept going on the days that felt long. That’s real.',
    },
  },
  21: {
    baby: {
      front: 'Settling into sleep and wake',
      back: 'The baby is about 27cm long and now weighs more than the placenta. Hearing keeps improving, and the baby is starting to have patterns of sleeping and waking.\n\nThe baby is also swallowing more of the fluid around them, which helps the digestive system practise. Movements may feel more like kicks and jabs than flutters now. You might notice the baby is busiest when you’re still, such as in bed at night.',
    },
    body: {
      front: 'Feeling a bit wobbly?',
      back: 'As the bump grows, your centre of balance shifts, so feeling unsteady is common. The baby may get busy just as you lie down to sleep. Backache and swollen feet can come and go as your body adjusts.\n\nSupportive, flat shoes and slow turns help. Bend your knees to lift things and keep your back straight. Tell your midwife or doctor about any bleeding, fluid leaking, severe pain, or sudden swelling of the face, hands or feet.',
    },
    try: {
      front: 'Notice the busy times',
      back: 'You may start noticing when the baby is most active, often in the evening or when you rest. Keep tapping Baby kicks on Today; over time you’ll learn their pattern.\n\nEvery baby has their own rhythm, so there’s no set number of movements to aim for. What matters is getting to know what’s usual for your baby. That way, if things ever feel different later on, you’ll notice and can tell your midwife or doctor.',
    },
    partner: {
      front: 'Feel for a kick',
      back: 'When she says the baby’s moving, put your hand on the bump and wait quietly. Try in the evening or when she’s lying down, as that’s often when the baby is busiest.\n\nYou might not feel it for a few weeks yet, as movements are easier to feel from the inside. Keep trying, and don’t be disappointed if it takes a while. The first time you do is a moment you’ll remember, and being ready for it means a lot to her.',
    },
    thought: {
      front: 'You’re getting to know each other.',
      back: 'The baby’s rhythms are starting to show, in quiet moments and in busy ones.\n\nEach day you learn a little more about the person you’re carrying. You’re already the one who knows them best, and that bond will only keep growing from here.',
    },
  },
  22: {
    baby: {
      front: 'Tasting what you eat',
      back: 'The baby is about 28cm long and practising breathing movements. Taste buds are developing, and flavours from what you eat can reach the baby through the amniotic fluid.\n\nThe baby isn’t breathing air yet, as they get oxygen through the placenta, but these movements help prepare the lungs. Their grip is getting stronger, and they may touch their face and feet. You may feel more regular movements now, and some people notice the baby reacting to loud sounds or to a favourite song.',
    },
    body: {
      front: 'Aches and new marks',
      back: 'Stretch marks, twinges, tiredness and some pelvic discomfort are things some people notice now. Pelvic pain happens as joints loosen to make room for the baby, and can be felt at the front or back.\n\nKeeping your knees together when you get in and out of bed or the car can help. If pain in the pelvis makes walking or turning in bed hard, tell your midwife or doctor; physio support is available. Tell them too about bleeding, fluid leaking or severe pain.',
    },
    try: {
      front: 'Eat the rainbow',
      back: 'Flavours you eat can reach the baby. Try adding one new fruit or vegetable to your meals this week, and log it on Meals.\n\nA mix of colours gives you a good range of vitamins and fibre, and fibre helps with constipation too. Frozen and tinned options count and are easy on tired days. Wash fruit and vegetables well, and keep up any daily vitamins your midwife or doctor has suggested, using the Vitamins tab as a reminder.',
    },
    partner: {
      front: 'Cook one new dish together',
      back: 'Pick a simple, colourful recipe and cook it together this week, with you doing the shopping and most of the chopping. Something with lots of vegetables, beans or lentils is easy and filling.\n\nShared meals are a nice habit to build before the baby arrives, and cooking together is relaxed time to talk. You’ll also have one more dish you can make on a tired night, which will be useful in the early weeks with a newborn.',
    },
    thought: {
      front: 'Nourishing yourself nourishes two.',
      back: 'Every meal is a small act of care, for you and for the baby.\n\nIt doesn’t have to be perfect to count. Toast on a hard day is still looking after yourself, and so is a glass of water and an early night. Small things add up.',
    },
  },
  23: {
    baby: {
      front: 'Arms and legs in proportion',
      back: 'The baby is about 29cm long. Arms and legs are now in proportion with the body, and the baby is practising breathing and building sleep and wake patterns.\n\nThe baby can now move quite vigorously, and you might even see the bump move when they kick. They respond to sounds and to movement, so they may get busier when you’re resting or when there’s music playing. Their movements will keep getting stronger.',
    },
    body: {
      front: 'Short of breath on the stairs?',
      back: 'As the womb grows and the ribcage expands, some people notice rib pain and feeling breathless. Your body is also making more blood and working harder, which adds to it. A little leaking from the breasts, called colostrum, can happen too.\n\nSlow down on stairs and sit tall to give your lungs room. Breast pads can help with leaks. Tell your midwife or doctor if breathlessness is sudden or severe, or comes with chest pain or a racing heart.',
    },
    try: {
      front: 'Start a nursery list',
      back: 'Make a simple list of what you’ll need: somewhere safe for the baby to sleep, a car seat, clothes, nappies. A cot or Moses basket with a firm, flat mattress is the main thing for sleep.\n\nStarting early means you can borrow, gift-list or buy slowly, and avoid a last-minute rush. Babies need less than shops suggest, so start with the basics and add later. Second-hand is often fine, but a new car seat or mattress is worth considering for safety.',
    },
    partner: {
      front: 'Own the big-item research',
      back: 'Take on researching the bigger items, like the car seat, cot and pram. Check car seats meet current UK safety standards and fit your car, and see whether the pram folds into the boot.\n\nShortlist a few and talk them through together, so she isn’t doing the reading on her own. Ask friends or family if they have anything to lend. It’s practical help she’ll really notice, and it takes some of the mental load off her.',
    },
    thought: {
      front: 'Every breath is enough.',
      back: 'Even when you feel a bit puffed, you’re carrying everything your baby needs.\n\nSlow down and let that be fine. Taking the stairs one step at a time is still getting to the top, and resting on the way is part of the climb.',
    },
  },
  24: {
    baby: {
      front: 'A big developmental milestone',
      back: 'The baby is about 30cm long. The lungs, brain and other organs keep maturing, and the baby is putting on weight week by week. This is a milestone week in development.\n\nThe baby’s movements are now a useful sign of how they’re doing. Every baby has their own pattern, and from here it’s worth getting to know it well. Movements don’t slow down towards the end of pregnancy, so any change is worth mentioning.',
    },
    body: {
      front: 'Hungrier than usual?',
      back: 'More appetite, back and rib aches as ligaments soften, tiredness, headaches and indigestion are common now. Small meals more often and sitting upright after eating can help indigestion.\n\nIf you’re feeling low or anxious most days, tell your midwife or doctor; support for how you feel matters as much as your body. From now on, if the baby’s movements slow down, change or stop, call your midwife or maternity unit straight away, day or night, rather than waiting.',
    },
    try: {
      front: 'Start a birth preferences note',
      back: 'Jot down what matters to you for the birth: who’ll be with you, pain relief you’d like to know about, what helps you feel calm. It’s a starting point to talk through with your midwife, not a fixed plan.\n\nYou might think about positions, music, lighting, and what you’d like to happen in the first hour after birth, such as skin-to-skin. Things can change on the day, so it helps to stay flexible. Note questions on your next appointment so you remember to ask.',
    },
    partner: {
      front: 'Learn your role on the day',
      back: 'Read her birth preferences and ask what she’d like you to do: speak up for her, keep visitors away, bring music, handle phone calls. Ask what helps her feel calm and what she’d rather you avoided.\n\nKnowing your role makes the day calmer for both of you. It’s also worth learning the signs that labour is starting and when to call the maternity unit. Save that number in your phone now, so you’re ready.',
    },
    thought: {
      front: 'You get to shape this.',
      back: 'There’s no right way to give birth, only the way that’s right for you.\n\nYour wishes matter, and it’s fine for them to change. You can ask questions, take your time and change your mind.',
    },
  },
  25: {
    baby: {
      front: 'Hiccups and somersaults',
      back: 'The baby is about 35cm long and very active. They now make urine, which helps keep the amniotic fluid topped up and at the right temperature. You might feel hiccups as little rhythmic taps.\n\nHiccups can last a few minutes and are nothing to worry about. The baby is turning and stretching a lot and has plenty of space for somersaults. As the weeks go on, you’ll get to know their pattern well, and any change in it is worth telling your midwife about.',
    },
    body: {
      front: 'A bit puffy?',
      back: 'Some swelling of the feet and ankles is common, especially later in the day and in warm weather. It happens because your body holds on to more fluid in pregnancy. Putting your feet up and comfortable shoes can help.\n\nIf your face, hands or feet swell suddenly, especially with a bad headache, blurry vision, or pain just below the ribs, call your midwife or doctor straight away. Call too if the baby’s movements slow down or change.',
    },
    try: {
      front: 'Raise your feet',
      back: 'Put your feet up for a while each evening, and try not to stand still for long stretches. Gentle ankle circles help too, moving each foot round in a circle a few times.\n\nRaising your feet helps fluid drain back up from your legs and can ease aching. Drinking plenty of water helps your body manage fluid. Comfortable shoes with room to spare make a difference by the end of the day. Note any swelling in Mood & symptoms so you can mention it at appointments.',
    },
    partner: {
      front: 'Evening foot rub',
      back: 'A foot or calf rub at the end of the day can ease swelling and is a lovely way to wind down together. Ask what feels good, use a plain moisturiser, and keep the pressure gentle.\n\nPop a cushion under her feet afterwards so they stay raised. If you notice sudden swelling in her face or hands, or she mentions headaches or changes to her vision, encourage her to call the midwife straight away. It’s a small daily ritual that she’ll really appreciate.',
    },
    thought: {
      front: 'Your baby has the hiccups, and that’s adorable.',
      back: 'Those little rhythmic taps are one more sign of someone busy and growing.\n\nEnjoy them. Rest a hand on the bump for a quiet minute and feel how lively your baby has become. You made that space for them.',
    },
  },
  26: {
    baby: {
      front: 'Eyes opening for the first time',
      back: 'The baby is about 36cm long, and their eyes are starting to open. Blinking comes next, and their eyelids, eyebrows and lashes are all in place.\n\nThe baby may react to bright light or loud noises, sometimes with a jump you can feel. They’re putting on more weight, and their movements are strong and regular. Keep getting to know their usual pattern, and tell your midwife or doctor if it ever slows down or changes.',
    },
    body: {
      front: 'Forgetful and a bit clumsy?',
      back: 'Tiredness, clumsiness, leg cramps and forgetfulness (often called baby brain) are common now. Lists and phone reminders help. It’s tiredness and a busy mind, nothing more.\n\nLooser joints and a changing shape can make you a bit less steady, so take your time on stairs. Call your midwife or doctor straight away about any bleeding, fluid leaking, severe headache, vision changes, sudden swelling, or a change in the baby’s movements.',
    },
    try: {
      front: 'Ask about vaccines',
      back: 'Some vaccines, like whooping cough, are offered in pregnancy to help protect the baby after birth. The antibodies you make pass to the baby and help protect them in the first weeks.\n\nAsk your midwife or doctor what’s recommended where you live and when. In the UK, whooping cough vaccine is offered from 16 weeks, and RSV vaccine from 28 weeks; flu vaccine is offered in autumn and winter. Add any booked vaccines to Appointments so you don’t miss them.',
    },
    partner: {
      front: 'Be the second memory',
      back: 'Keep track of the dates, forms and errands this week so she doesn’t have to. That might mean appointment times, maternity leave forms, or sorting the vaccine booking.\n\nSet up shared reminders and quietly handle the follow-ups, without asking her to check your work. Tiredness makes it harder to hold everything in mind, and taking over the admin frees her head for other things. It also means fewer things slip through the gaps.',
    },
    thought: {
      front: 'Forget the keys, remember this.',
      back: 'You’re carrying a lot, in every sense, and your mind is busy for good reason.\n\nBe gentle with yourself about the small stuff. The things that matter most are still in hand, and anything you forget can be sorted later. You’re doing well.',
    },
  },
  27: {
    baby: {
      front: 'Filling out',
      back: 'The baby is about 37cm long. The lungs are maturing, and the baby is filling out with a layer of fat as the organs keep developing.\n\nThe baby is moving a lot and may respond to your voice and to music. Their movements stay strong right up to the birth, so if they ever slow down or change, call your midwife or maternity unit straight away rather than waiting. This is the last week of the second trimester.',
    },
    body: {
      front: 'Snoring, bloating and backache',
      back: 'Bloating, constipation, tiredness and even snoring are common at the end of the second trimester, along with backache and leg cramps. Snoring can happen because the lining of your nose swells a little.\n\nFibre, water and gentle movement help. From about 28 weeks, going to sleep on your side is recommended, so it’s a good time to get used to it. Tell your midwife or doctor about bleeding, severe pain, headaches with vision changes, or a change in the baby’s movements.',
    },
    try: {
      front: 'Look back on the trimester',
      back: 'Scroll through your bump photos and Progress charts from the last few months. It’s a good moment to notice how far you’ve come.\n\nYou might add a short note about what you’ve learned and what you’re looking forward to. Check Appointments for what’s coming in the third trimester, as checks get more frequent. A quick look at Reports can help you gather any scan letters and questions for your next visit.',
    },
    partner: {
      front: 'Write her a note',
      back: 'Write a short note to her, or to the baby, about the last three months. Mention specific moments, like the scan, the first kick you felt, or something she did that you admired.\n\nLeave it somewhere she’ll find it, like her bag or bedside table. Words on paper last longer than you think, and she may want to keep it for the baby’s memory box. It’s a simple way to say that you’ve noticed everything she’s been doing.',
    },
    thought: {
      front: 'Two trimesters done.',
      back: 'One more to go. Whatever the last few months held, you’ve carried it all.\n\nThat’s something to be proud of. Take a moment to rest and look back before the last stretch begins. You’re nearly there.',
    },
  },
  28: {
    baby: {
      front: 'A heartbeat around 140',
      back: 'The baby is about 38cm long, head to heel, and weighs around 1kg. Their heart has slowed to around 140 beats a minute, still much faster than yours. Their eyes can open and close now, and they spend a lot of time asleep, often in short cycles.\n\nFrom here, it’s mostly growing and getting stronger. The brain is developing quickly, the lungs keep maturing, and a layer of fat is slowly building under the skin. Each week they become better prepared for life outside the womb.',
    },
    body: {
      front: 'The third trimester begins',
      back: 'Heartburn, backache, swollen ankles, nosebleeds and trouble sleeping are things some people notice now. Your growing bump presses on your stomach and back, and extra blood flow can make the inside of your nose more delicate. Rest, smaller meals and putting your feet up help with a lot of it.\n\nIf the baby’s movements ever slow down or change, call your midwife or maternity unit straight away, day or night. Call too for bleeding, a severe headache, blurry vision, sudden swelling of your face, hands or feet, or itching, especially on your hands and feet.',
    },
    try: {
      front: 'Get to know the baby’s pattern',
      back: 'Each baby has their own pattern of movement, with busy times and quiet times. There’s no set number of kicks to aim for. What matters is knowing what’s usual for your baby, so you’d notice if things changed.\n\nPick a time your baby is often active, like after a meal or when you lie down in the evening, and notice how they move. Tap a kick on Today as you feel them so you both learn the rhythm. You never need to wait to call if something feels different, even at night.',
    },
    partner: {
      front: 'Know who to call',
      back: 'Save the midwife and maternity unit numbers in your phone, and add the one to ring to the contraction timer in Bloom. Find out which number to use out of hours, as it’s often different from the daytime one.\n\nIf she ever says the baby feels quieter than usual, help her call straight away, without waiting to see. Offer to make the call or drive her in if she’s asked to come. Knowing you’ll act quickly and calmly can take a real weight off her mind in these last months.',
    },
    thought: {
      front: 'The home stretch starts here.',
      back: 'Three months to go, give or take. You’ve already done so much, often without anyone seeing it.\n\nLet this last stretch be about rest, nesting and getting ready to meet them, at whatever pace your body asks for. You’re allowed to go slowly.',
    },
  },
  29: {
    baby: {
      front: 'All there, now growing strong',
      back: 'The baby is about 39cm long and fully formed. These last weeks are about the organs maturing and building fat to stay warm after birth.\n\nTheir movements are getting stronger and more varied, so you may feel kicks, jabs and rolls, and sometimes see your bump shift. You might also notice gentle, regular jumps now and then, which are often hiccups. The baby is practising breathing movements too, ready for their first real breath.',
    },
    body: {
      front: 'Breathless and up at night',
      back: 'Breathlessness, leg cramps, needing the loo more and broken sleep are common now, along with feeling less steady on your feet. Your womb is pushing up under your lungs and down on your bladder, and your balance shifts as the bump grows.\n\nGoing to sleep on your side, with a pillow under your bump and between your knees, is recommended in the third trimester, as it’s safer for the baby. Gentle calf stretches before bed may ease cramps. Call your midwife if breathlessness comes on suddenly or comes with chest pain.',
    },
    try: {
      front: 'Choose your birth partner',
      back: 'Decide who you’d like with you during labour, and maybe a back-up in case they can’t make it. It could be your partner, a friend, a family member, or more than one person if your hospital allows it.\n\nShare your birth preferences note with them so they know what matters to you, like how you’d like to manage pain or who cuts the cord. Talk through what helps you feel calm when you’re stressed. Your midwife can tell you how many birth partners are allowed where you’re booked.',
    },
    partner: {
      front: 'Get ready to be the birth partner',
      back: 'If you’re her birth partner, read her birth preferences again and ask what she’d like from you. Some people want words of encouragement, others want quiet and a hand to squeeze.\n\nIf you can, book an antenatal class together that covers the partner’s role, labour and the first days with a newborn. Ask her midwife about local NHS classes, which are often free. Being well informed means you can speak up for her when she’s busy with labour.',
    },
    thought: {
      front: 'You don’t have to do this alone.',
      back: 'Lean on the people around you, whether it’s a lift to an appointment or someone to listen when the day feels long.\n\nAsking for help now is a skill that will serve you well when the baby arrives. It’s a strength, not a weakness, and people are glad to be asked.',
    },
  },
  30: {
    baby: {
      front: 'Eyes that can focus',
      back: 'The baby is about 40cm long, and their eyes can now focus. They can tell light from dark, and may turn towards a bright light shining on your bump.\n\nVision will keep developing for months after birth. Newborns see best at about 20 to 30cm, roughly the distance to your face when you hold them close. Their brain is growing fast, and they’re steadily laying down fat, so their skin looks less wrinkled each week.',
    },
    body: {
      front: 'Strange dreams?',
      back: 'Trouble sleeping and vivid or unsettling dreams are common now, along with backache and swollen feet. Dreams like these are just a busy mind processing a lot of change. Talk them through if they bother you, or jot them down and let them go.\n\nA warm bath, a wind-down routine and keeping screens away before bed can help. Swollen feet often ease with rest and feet raised. Sudden swelling of your face, hands or feet, especially with a headache or blurred vision, is worth calling your midwife or maternity unit about straight away.',
    },
    try: {
      front: 'Check on your vaccines',
      back: 'If you haven’t already, ask your midwife or doctor about vaccines offered in late pregnancy, like whooping cough and RSV, and when the best time is.\n\nHaving them in pregnancy passes protection to the baby through the placenta, so they’re covered in their first weeks, before they can have their own vaccines. Your GP surgery or midwife can usually book them. Add the appointments in Bloom’s Appointments so you both have a reminder, and note the date once done.',
    },
    partner: {
      front: 'Take over one weekly chore',
      back: 'Pick one regular job that’s getting harder for her, like the laundry, cleaning the bathroom or the big shop, and make it yours from now until well after the birth.\n\nBending, lifting and standing for long spells get tougher as the bump grows. Owning the job completely, without being asked or reminded, is what makes the difference. It frees up her energy for rest and shows her she can count on you in the months ahead.',
    },
    thought: {
      front: 'Your baby will know your face first.',
      back: 'Those newly focusing eyes will soon look up at you, close enough to see every detail of your face.\n\nThat moment is getting closer every day. Out of everyone in the world, you’ll be the first person they learn by heart, and the one they turn to most.',
    },
  },
  31: {
    baby: {
      front: 'Somersaults and finger-sucking',
      back: 'The baby is about 41cm long and very active: moving around, sucking their fingers and doing the odd somersault. They’re getting plumper and less wrinkled each day.\n\nSucking is an important skill to practise now, as it helps with feeding after birth. Their lungs and digestive system are nearly mature, and their brain is making lots of new connections. As space gets tighter, movements may feel more like rolls and pushes than sharp kicks, but they don’t slow down.',
    },
    body: {
      front: 'Practice tightenings',
      back: 'Some people feel the bump tighten for 20 to 30 seconds and then relax. These practice contractions, called Braxton Hicks, are usually painless and come irregularly. Your womb is warming up its muscles for labour.\n\nChanging position, a short walk or a warm drink can help them settle. If they become regular, stronger or painful, call your midwife or maternity unit, as this may be early labour. Call too if you have any fluid leaking, bleeding, or if the baby’s movements change.',
    },
    try: {
      front: 'Try the contraction timer',
      back: 'Open the contraction timer in Bloom and have a quick look, so it’s familiar later. Tap to start when a tightening begins and again when it ends, and the timer works out how long each lasts and how far apart they are.\n\nAdd your own “when to call” plan from your midwife, in your own words. Plans differ depending on whether this is your first baby and how far you live from the hospital, so it’s worth asking at your next appointment.',
    },
    partner: {
      front: 'Learn the contraction timer',
      back: 'Learn how the timer works now, so on the day you can time contractions while she focuses on breathing. Try a practice run together using a pretend contraction or two.\n\nKnow where her “when to call” plan is, and save the maternity unit number somewhere quick to reach. In early labour, she may not want to talk or look at a phone. Having you keep track quietly means she can stay in her own rhythm and you’ll know when it’s time to ring.',
    },
    thought: {
      front: 'Your body is rehearsing.',
      back: 'Every tightening is practice for something extraordinary. Your body already knows a lot about what’s coming.\n\nYou’re more prepared than you feel. Whatever you don’t know yet, you can trust yourself to learn as you go, with people beside you who want to help.',
    },
  },
  32: {
    baby: {
      front: 'Putting on weight',
      back: 'The baby is about 42cm long and fully formed, and now mainly needs to gain weight. Over the coming weeks they’ll add around a kilo of fat, which helps keep them warm after birth.\n\nTheir fingernails have grown, and the soft hair covering their body is starting to fall away. Many babies settle head-down around now or in the next few weeks, though there’s still time to turn. Your midwife will feel your bump to check their position at your appointments.',
    },
    body: {
      front: 'Heavier and more tired',
      back: 'More tiredness, side twinges, backache, swelling and broken sleep are common now. You’re carrying extra weight, and the ligaments around your bump are stretching. Short naps, a pillow between your knees and swimming or gentle stretches can help.\n\nThe baby’s movements carry on right up to birth. If you notice them slowing or changing, call your midwife or maternity unit straight away. Call too for bleeding, a bad headache, vision changes, sudden swelling, constant tummy pain or itching.',
    },
    try: {
      front: 'Finish your birth preferences',
      back: 'Look over your birth preferences note and talk it through at your next appointment. Think about where you’d like to give birth, pain relief, positions, skin-to-skin, and how you’d like to feed.\n\nYour midwife can explain what’s available locally and help you think about what you’d want if plans change, like a caesarean. Keep it short and easy to read. Keep a copy on your phone and one in your bag, so your birth partner can share it.',
    },
    partner: {
      front: 'Plan the route',
      back: 'Work out how you’ll get to the hospital or birth centre: the route, a back-up, parking, and the entrance to use at night, as the main doors are sometimes locked.\n\nDo a practice drive if you can, at different times of day to see how traffic changes. Check how parking is paid for and keep some change or the app ready. If you don’t drive, save a local taxi number. On the day, knowing exactly where to go means one less thing to think about.',
    },
    thought: {
      front: 'Plans are a guide, not a promise.',
      back: 'Births don’t always follow the plan, and that’s fine. You can change your mind at any point, and so can the people caring for you.\n\nWhat matters most is that you’re heard, kept informed and cared for along the way, whatever path the day takes.',
    },
  },
  33: {
    baby: {
      front: 'Bones hardening, skull still soft',
      back: 'The baby is about 44cm long. The brain and nervous system are fully developed, and the bones are hardening, except the skull, which stays soft to make birth easier.\n\nThe skull plates can overlap slightly as the baby moves through the birth canal, which is why some newborns have a slightly pointed head for a day or two. The soft spots, called fontanelles, close over the first couple of years. The baby is also getting better at controlling their own temperature.',
    },
    body: {
      front: 'Heaviness low down',
      back: 'Some people feel heaviness in the pelvis as the baby moves into a head-down position, along with Braxton Hicks, tiredness and indigestion. The weight of the baby pressing down can make walking feel awkward.\n\nRest with your feet up when you can, and try eating smaller meals more often to ease indigestion. A support belt may help with pelvic heaviness. If you notice pain in the pelvis when walking or turning over in bed, mention it to your midwife, as physio can help.',
    },
    try: {
      front: 'Pack the hospital bag',
      back: 'Start packing a bag for labour and after the birth: comfy clothes, toiletries, snacks, phone charger, baby clothes and nappies. Ask your hospital for their own list too.\n\nGood extras include maternity pads, a dressing gown, slippers, a nightie or big T-shirt, nipple cream, and a hat and blanket for the baby. Packing now means you’re ready if the baby comes early. Make a short list of anything still to buy and share it with your partner, so they can help.',
    },
    partner: {
      front: 'Pack your own bag',
      back: 'Pack a small bag for yourself too: snacks, a change of clothes, charger, a power bank, and anything to keep her comfortable, like a hairband, lip balm or a playlist.\n\nPut the car seat in the car and practise fitting it, as it can be fiddly. Many hospitals won’t let you drive home without one. If you can, watch the maker’s video and check it fits your car. Being ready yourself means you can focus fully on her when the time comes.',
    },
    thought: {
      front: 'You’re building a nest.',
      back: 'Every little thing you prepare is a welcome for someone you love already.\n\nThe folded clothes, the packed bags and the cot by the bed are love in action, even on the days you’re running low on energy. Do what you can, and let the rest wait.',
    },
  },
  34: {
    baby: {
      front: 'Settling into position',
      back: 'The baby is about 45cm long. Many babies are moving lower into the pelvis around now, getting ready for birth.\n\nTheir protective coating, called vernix, is getting thicker, while the fine body hair keeps falling away. The lungs and nervous system are maturing well. Babies born from now on, if healthy otherwise, usually do well, though they may need a little extra care. Your midwife may check the baby’s position at your appointment this week.',
    },
    body: {
      front: 'Breathing a little easier?',
      back: 'When the baby drops lower, there can be less pressure on the lungs and stomach, but more on the bladder, and walking may feel harder. This doesn’t mean labour is about to start, it can happen weeks before.\n\nFrequent loo trips are common, but pain or stinging when you wee may mean an infection, so it’s worth telling your midwife. Call your maternity unit straight away if you notice a change in movements, bleeding or fluid leaking.',
    },
    try: {
      front: 'Plan your leave',
      back: 'If you work, think about when you’d like to start your leave and let your workplace know. In the UK you’re asked to tell your employer at least 15 weeks before your due date, but you can usually change the start date with notice.\n\nLeave time to rest before the baby arrives if you can. Check what pay you’re entitled to and how holiday time adds up. Hand over any work early, so you can switch off without worrying.',
    },
    partner: {
      front: 'Plan your own time off',
      back: 'Sort out your leave for the birth and the first weeks after. Check what paternity or partner leave you can take, and how it’s paid.\n\nAgree with work how you’ll be reached when labour starts, so you can leave quickly, and hand over anything urgent ahead of time. Those first weeks at home are when she’ll most need you, for feeding, rest and simply sharing the load. Knowing you’ll be around can be a huge comfort to her now.',
    },
    thought: {
      front: 'Slowing down is part of getting ready.',
      back: 'You don’t have to finish every task before the baby comes. The list can wait, and most of it won’t matter much in the end.\n\nRest is preparation too, and so is a quiet afternoon on the sofa doing nothing at all. Give yourself permission to slow down.',
    },
  },
  35: {
    baby: {
      front: 'Getting chubbier',
      back: 'The baby is about 46cm long and getting rounder, which will help them stay warm after birth.\n\nThere’s not much room to move now, so you may feel fewer big kicks and more wriggles, stretches and pushes. That’s fine, as long as their movements don’t slow down or change from their usual pattern. Their kidneys are fully developed and their liver can process some waste. Most of their growing from now on is about gaining weight.',
    },
    body: {
      front: 'Sore ribs and broken sleep',
      back: 'A little foot under the ribs, Braxton Hicks, trouble sleeping and swollen hands and feet are common now. Sitting upright and stretching gently can ease rib soreness.\n\nRaising your arms above your head can give your ribs a moment of relief. If your hands feel tingly or numb, it may be pressure on the nerves at the wrist, which your midwife can advise on. Sudden swelling of your face, hands or feet, or a severe headache, is worth calling your maternity unit about straight away.',
    },
    try: {
      front: 'Learn about pain relief options',
      back: 'Ask your midwife which pain relief options are available where you’ll give birth, from breathing and water to medical options. Knowing them ahead of time makes choices easier on the day.\n\nOptions often include a birth pool, a TENS machine, gas and air, injections like pethidine, and an epidural, though not every place offers all of them. Add your questions to your next appointment in Bloom. Many people decide some things in advance and keep an open mind about the rest.',
    },
    partner: {
      front: 'Practise breathing together',
      back: 'Learn a simple breathing pattern for labour together, like breathing in for four and out for six. A longer out-breath can help her body relax and cope with each contraction.\n\nPractise for a few minutes in the evening, so you can guide her when it counts. Breathe alongside her and count softly. Try a firm hand on her lower back too, and ask what feels good. The more familiar it feels now, the more naturally it will come back to you both in labour.',
    },
    thought: {
      front: 'Breathe in calm, breathe out doubt.',
      back: 'You don’t have to feel brave every moment. Some days you’ll feel ready and some days you won’t, and both are fine.\n\nYou only need to take the next breath, and then the one after that. That’s how every big thing gets done, one breath at a time.',
    },
  },
  36: {
    baby: {
      front: 'Lungs nearly ready',
      back: 'The baby is about 47cm long. The lungs are likely mature enough to work on their own, and the baby can now suck and digest milk. Many babies are head-down in the pelvis by now.\n\nYour midwife will check the baby’s position at your appointment. If they’re bottom-first, called breech, you may be offered a scan and a chance to talk about options, including trying to gently turn the baby. Their body hair and vernix are mostly gone now.',
    },
    body: {
      front: 'A little leak when you laugh?',
      back: 'Braxton Hicks, broken sleep, backache, swelling, and a little leaking when you cough or laugh are common now. The baby’s weight presses on your bladder and pelvic floor muscles. Pelvic floor exercises help, and they also aid recovery after birth.\n\nKeep an eye on the baby’s movements, and call straight away if they change. If you’re not sure whether a leak is wee or your waters, call your maternity unit, as they can check for you.',
    },
    try: {
      front: 'Finish the hospital bag',
      back: 'Add the final bits: your pregnancy notes, birth preferences, phone numbers and chargers. Leave the bag by the door.\n\nPack a long charging cable, as sockets can be far from the bed. Add a snack bag, a water bottle with a straw, and a going-home outfit for you and the baby. If you have scan letters in Bloom’s Reports, check you can open them easily. Tell your partner where everything is, so they can find it in a hurry.',
    },
    partner: {
      front: 'Ready the home for coming back',
      back: 'Make the first days home easier: fill the freezer with a few meals, stock up on basics like loo roll, nappies and painkillers she might want, and set up where the baby will sleep.\n\nThe safest place for the baby to sleep is on their back, in a cot or Moses basket in your room, with a firm, flat mattress and no pillows or bumpers. A calm, stocked home means she can focus on recovering and getting to know the baby.',
    },
    thought: {
      front: 'Nearly there.',
      back: 'So much of the waiting is behind you. Everything is coming together, one small step at a time.\n\nBe proud of how far you’ve carried them, through the tired days and the sleepless nights. Let yourself rest in that, and enjoy the last of this quiet.',
    },
  },
  37: {
    baby: {
      front: 'Full term',
      back: 'The baby is about 49cm long and now considered full term. Most babies are head-down, ready for birth.\n\nBabies born from now on are usually ready to feed and breathe on their own. Their gut contains their first poo, called meconium, a dark sticky substance that usually passes in the first days after birth. They’re still putting on fat, and their grasp is getting stronger, ready to wrap around your finger.',
    },
    body: {
      front: 'The urge to nest',
      back: 'Some people feel a burst of energy to clean and organise. Heartburn may ease as the baby moves lower, and Braxton Hicks carry on. Nest if it feels good, but rest just as much, and avoid climbing ladders or heavy lifting.\n\nLabour can start any time now. Call your midwife or maternity unit if your waters break, you have bleeding, contractions become regular, or the baby’s movements change. Call too for a severe headache, vision changes, sudden swelling, constant tummy pain or itching.',
    },
    try: {
      front: 'Ask about newborn checks',
      back: 'Ask your midwife which checks and screening the baby is offered after birth, so nothing comes as a surprise in those first days.\n\nIn the UK, these usually include a physical check of the eyes, heart, hips and more within 72 hours, a hearing test, and a heel prick blood test at around five days old. You’ll also be offered vitamin K for the baby soon after birth. Ask questions and note the answers in Bloom so you can make choices in advance.',
    },
    partner: {
      front: 'Know how you’re both doing',
      back: 'Feeling low after a birth can happen to either parent. The baby blues are common in the first week and usually pass. Learn the signs that last longer, like ongoing sadness, worry, not sleeping even when you can, or not feeling like yourself.\n\nAgree you’ll both speak up and talk to your midwife, health visitor or doctor if they appear. Check in with her each day after the birth with a simple “how are you really?” Having the plan in place now makes it easier to ask for help.',
    },
    thought: {
      front: 'Any day now could be the day.',
      back: 'You’re ready enough. Nobody is ever completely ready, and that’s alright.\n\nYou’ll learn the rest together, one day at a time, just as every parent does. You’ve already done so much of the hardest work, and your baby is lucky to have you.',
    },
  },
  38: {
    baby: {
      front: 'Getting ready to meet you',
      back: 'The baby is about 50cm long. Most of the soft lanugo hair has gone, and the baby is fully prepared for life outside.\n\nThey’re practising sucking, swallowing and grasping, all skills they’ll use straight away. Their organs are ready, and they keep adding fat. Babies are often born with a few patches of vernix still on their skin, especially in creases, and this soaks in naturally over the first days. Eye colour may change over the first months.',
    },
    body: {
      front: 'Impatient and uncomfortable?',
      back: 'Braxton Hicks, broken sleep, backache, swelling, indigestion and impatience are all common now. Feeling ready to stop being pregnant is completely understandable. Gentle walks and rest can both help.\n\nUse this time for small pleasures and catching up on sleep where you can. Call your midwife or maternity unit if your waters break, you have bleeding, contractions become regular, or you notice any change in the baby’s movements. You’re never a bother for calling.',
    },
    try: {
      front: 'Make a plan for visitors',
      back: 'Decide together who visits in the first days and weeks, and when. Agree a simple message for family, like “we’ll let you know when we’re ready”.\n\nThink about what helps: short visits, people bringing food, or visitors doing a job like washing up. Some couples ask visitors to come only if they’re well and to wash their hands. Write your plan down somewhere you can both find it, so you can point to it when the messages start arriving.',
    },
    partner: {
      front: 'Be the gatekeeper',
      back: 'Handle visitor messages and updates to family so she can rest. Be the one who says “not yet” kindly when you both need space.\n\nKeep visits short and leave room for feeds and naps. If someone offers help, have a ready answer, like a meal or a supermarket run. Watch for when she’s tired and gently wrap visits up. It protects her recovery and gives you both time to settle into life as a family.',
    },
    thought: {
      front: 'The waiting is part of the story.',
      back: 'These last days are their own kind of special, even when they feel slow and heavy.\n\nSoon you’ll be holding the person you’ve been waiting for, and this quiet time will become a memory. Let yourself enjoy the small moments while you can.',
    },
  },
  39: {
    baby: {
      front: 'Wrapped in a protective coat',
      back: 'The baby is about 51cm long, and their skin may still have some vernix, a waxy coat that protected it in the womb and helps them on their way out.\n\nThe baby is gaining weight right up until birth. Their skull bones are still soft and can shift a little to help them through the birth canal. Their immune system is getting a boost from antibodies passed on to them through the placenta.',
    },
    body: {
      front: 'Signs labour may be getting close',
      back: 'More discharge, backache and pressure low down are common. A “show” of mucus, sometimes streaked with blood, can mean labour is getting closer, though it may still be days away.\n\nIf your waters break, call your midwife or maternity unit straight away, even if there are no contractions. Note the time and colour of the fluid. Call too for heavier bleeding, regular contractions, a change in the baby’s movements, a severe headache or constant tummy pain.',
    },
    try: {
      front: 'Keep the timer handy',
      back: 'Keep Bloom’s contraction timer one tap away. If tightenings come regularly, time them and follow your “when to call” plan.\n\nEarly labour can last hours, and many people stay at home for a while, resting, eating light snacks and keeping hydrated. Try a warm bath, gentle movement or leaning forward over a ball or chair. Ring your maternity unit when your plan says to, or any time you feel unsure.',
    },
    partner: {
      front: 'Phone charged, bag in the car',
      back: 'Keep your phone charged and with you, and the bags near the door or in the car. Make sure you can be reached at work, and keep fuel in the tank.\n\nKeep the maternity unit number on speed dial, and plan who looks after pets or older children if you’re called in at night. When labour starts, she’ll take her cue from you. Staying steady and organised helps her feel safe.',
    },
    thought: {
      front: 'You’ve got this, together.',
      back: 'Whatever happens next, you won’t be facing it alone.\n\nYou have people around you who love you, a team ready to care for you, and a body that has carried your baby safely this far. Take each moment as it comes. You’re stronger than you know.',
    },
  },
  40: {
    baby: {
      front: 'Due date week',
      back: 'The baby is about 51cm long and ready to meet you. Many babies weigh around 3.5kg by now, though healthy babies come in a wide range of sizes.\n\nMovements carry on right up to birth, so keep noticing them. If they slow down or change, call your maternity unit straight away. Their bones, except the skull, are firm, and their lungs are ready for their first breath. Their grasp is strong too, ready to hold on tight.',
    },
    body: {
      front: 'Waiting, waiting',
      back: 'Braxton Hicks, trouble sleeping, backache, indigestion and swelling are common now. Lower back pain that comes and goes can be an early sign of labour. Only a small number of babies arrive on the actual due date.\n\nMany first babies come after it, so try not to fix on the date. Call your midwife or maternity unit if your waters break, you have bleeding, contractions become regular, or the baby’s movements change. A severe headache or sudden swelling is worth a call too.',
    },
    try: {
      front: 'Keep your appointment',
      back: 'Your midwife may want to check your blood pressure and urine this week. Keep the appointment, and bring any questions about what happens if the baby doesn’t arrive soon.\n\nIf this is your first baby, you may be offered a membrane sweep, where the midwife gently sweeps a finger around the neck of the womb to help labour start. Ask what’s offered locally. Add your questions to the appointment in Bloom, and write the answers there afterwards.',
    },
    partner: {
      front: 'Keep spirits up',
      back: 'Plan small, easy distractions: a favourite film, a slow walk, a takeaway. Keep things light and remind her she’s doing an amazing job.\n\nTry not to ask “anything happening?” too often, as she’ll tell you. Offer back rubs, warm baths and early nights. Let her vent about feeling fed up without trying to fix it. Waiting can be hard on both of you, and a bit of fun and comfort makes the days pass more gently.',
    },
    thought: {
      front: 'Your baby is coming at their own pace.',
      back: 'A due date is a guess, not a deadline. Your baby is on their way and will arrive when they’re ready.\n\nUntil then, you’re allowed to rest, to feel impatient, and to enjoy these last quiet days. Nothing you’re feeling right now is wrong.',
    },
  },
  41: {
    baby: {
      front: 'Fully ready',
      back: 'The baby is fully mature, often weighing around 3 to 4kg, and just taking their time.\n\nSome babies born after their due date have dry or peeling skin and longer nails, which settles in a few days. Your midwife will keep an eye on you both. Keep paying attention to their movements, and call your maternity unit straight away if they slow down or change. Don’t wait until the next day.',
    },
    body: {
      front: 'Past the due date',
      back: 'Braxton Hicks, poor sleep, backache, swelling and frustration are common now. Your midwife or doctor will talk you through the options from here, including when labour might be started for you.\n\nYou’ll usually be offered a membrane sweep and a date for induction, often around 41 to 42 weeks. If you’d rather wait, you can ask about extra monitoring. Call your maternity unit if your waters break, you have bleeding, or the baby’s movements change.',
    },
    try: {
      front: 'Talk through next steps',
      back: 'Ask your midwife or doctor what happens next and when. Note their answers on your appointment in Bloom so you both have them.\n\nUseful questions include how induction works at your hospital, how long it might take, what pain relief is available, and whether your birth partner can stay with you. Ask what to pack for an induction, as you may be there a while. Knowing the plan can ease the uncertainty.',
    },
    partner: {
      front: 'Hold the patience for both of you',
      back: 'Field the “any news?” messages so she doesn’t have to. A shared reply to family can save her dozens of answers each day.\n\nTry something like “no news yet, we’ll tell you when there is”. Go with her to appointments if you can, and keep the hospital bag and car ready. Help her rest, eat well and stay comfortable. A calm, steady presence from you makes these extra days feel much lighter for her.',
    },
    thought: {
      front: 'Any day now.',
      back: 'The longest wait is almost over. You’ve been so patient, even on the days it didn’t feel like it.\n\nSoon this will be a story you tell, with your baby in your arms and these long days a distant memory. Hold on a little longer.',
    },
  },
};
