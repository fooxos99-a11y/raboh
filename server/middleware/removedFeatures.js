const excludedRoutes = /^\/(?:daily-challenge|summit|store|cultural-games|nazem|game-used-questions|letter-hive|categories-game|auction-game|guess-image-game|activity-logs)(?:\/|$)/;

export function removedFeaturesMiddleware(req, res, next) {
  const removedFeature = excludedRoutes.test(req.path) || /^\/students\/\d+\/paths(?:\/|$)/.test(req.path);
  if (removedFeature) return res.status(410).json({ message: 'هذه الميزة محذوفة من المنصة.' });
  return next();
}
