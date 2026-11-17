// Phase 1 fills this in: shops, card tiers, Ana's 60 days, bills, goal.
const DATA = {
  persona: { name: 'Ana', card: 'platinum' },
  cardTiers: {
    black:    { label: 'Altitude Black', multiplier: 3, sources: ['extras', 'shopback', 'altitude'] },
    platinum: { label: 'Platinum',       multiplier: 2, sources: ['extras', 'shopback'] },
    debit:    { label: 'Debit',          multiplier: 1, sources: ['shopback'] }
  },
  goal: { name: 'Japan in June', target: 4000, saved: 1250 },
  shops: [],        // ~25 shops: { id, name, category, lat, lng, offer, source, hero }
  transactions: [], // 60 days for Ana
  bills: [],        // rent, card payment
  balance: 0
};
