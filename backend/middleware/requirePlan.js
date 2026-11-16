const PLAN_LEVEL = { starter: 1, pro: 2, klub: 3 };
const PLAN_LABEL = { pro: 'Pro', klub: 'Klub' };

// Mirrors the hierarchy already used client-side (frontend/assets/js/auth.js)
// to decide which sidebar links are shown. super_admin manages the whole
// platform and isn't tied to any single club's subscription, so it bypasses
// this check entirely.
module.exports = (requiredPlan) => (req, res, next) => {
  if (req.user.role === 'super_admin') return next();

  const clubLevel = PLAN_LEVEL[req.user.plan] || PLAN_LEVEL.starter;
  const neededLevel = PLAN_LEVEL[requiredPlan] || 99;

  if (clubLevel < neededLevel) {
    return res.status(403).json({
      code: 'PLAN_REQUIRED',
      message: `Ova funkcionalnost je dostupna u ${PLAN_LABEL[requiredPlan] || requiredPlan} planu.`,
      requiredPlan
    });
  }

  next();
};
