// Ready-made meeting agendas (organizations can also save their own).
export const AGENDA_TEMPLATES: { name: string; agenda: string }[] = [
  { name: 'Team check-in', agenda: '1. Wins since last time\n2. What each person is working on\n3. Blockers and help needed\n4. Decisions to make\n5. Action items and owners' },
  { name: 'Event planning', agenda: '1. Event goals and audience\n2. Date, venue and budget\n3. Lineup and performers\n4. Tickets, pricing and promotion\n5. Volunteers and roles\n6. Timeline and next steps' },
  { name: 'Post-event debrief', agenda: '1. Attendance and ticket sales\n2. What went well\n3. What to improve\n4. Feedback from attendees and performers\n5. Money: revenue, costs and payouts\n6. Ideas for next time' },
  { name: 'Board meeting', agenda: '1. Call to order and attendance\n2. Approve last meeting\u2019s minutes\n3. Financial report\n4. Committee and program updates\n5. Old business\n6. New business\n7. Votes and decisions\n8. Adjourn' },
  { name: 'Volunteer briefing', agenda: '1. Welcome and thank you\n2. Event schedule for the day\n3. Roles and where everyone goes\n4. Safety, check-in and emergency contacts\n5. Questions' },
];
