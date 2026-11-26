// Quantity limits per plan, as advertised on the marketing pricing page
// (frontend/plan-starter.html comparison table). Unlike requirePlan (which
// locks whole features behind a plan), these cap how many of something a
// club can have - enforced at the point of creation, not via middleware.
const MEMBER_LIMIT = { starter: 25, pro: 150, klub: Infinity };
const SELECTION_LIMIT = { starter: 1, pro: 5, klub: Infinity };

module.exports = { MEMBER_LIMIT, SELECTION_LIMIT };
