/**
 * @param {string} name
 * @returns {import("express").RequestHandler}
 */
export const render = name => (req, res, _next) => {
  const urlObj = req.urlObj;
  const { title, imageUrl = `${urlObj.origin}/icon.svg`, description, data, viewData, fromStale, staleSince } = res.locals;


  res.locals = {};
  res.status(200).render(name, {
    data: viewData ?? data,
    meta: {
      url: urlObj,
      title,
      imageUrl,
      description,
      ...(fromStale && staleSince && { archivedAt: new Date(staleSince) }),
    },
  });
};
