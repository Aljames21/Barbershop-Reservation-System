function summarizeFeedbackRatings(feedback) {
  const ratings = feedback
    .filter((item) => item && item.status === "Approved")
    .map((item) => Number(item.rating))
    .filter((rating) => Number.isInteger(rating) && rating >= 1 && rating <= 5);
  const distribution = [1, 2, 3, 4, 5].map((stars) => ({
    stars,
    count: ratings.filter((rating) => rating === stars).length
  }));

  return {
    count: ratings.length,
    average: ratings.length
      ? ratings.reduce((total, rating) => total + rating, 0) / ratings.length
      : null,
    fiveStarCount: distribution[4].count,
    distribution
  };
}
