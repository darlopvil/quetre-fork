import catchAsyncErrors from '../utils/catchAsyncErrors.js';
import { storeList } from '../utils/store.js';
import getSearch from '../fetchers/getSearch.js';

export const search = catchAsyncErrors(async (req, res, next) => {
  const { q, after, type } = req.query;

  if (!q) {
    return res.status(200).render('search', {
      data: { results: [], query: '' },
      meta: {
        title: 'Búsqueda',
        url: req.urlObj,
        imageUrl: `${req.urlObj.origin}/icon.svg`,
        description: 'Buscar en Quora.',
      },
    });
  }

  let data = res.locals.data;
  if (!data) data = await getSearch(q, { after, type });

  res.locals.data = { ...data, query: q };
  res.locals.title = `Búsqueda: ${q}`;
  res.locals.description = `Resultados de búsqueda para ${q}.`;

  return next();
});

/** @type {import("express").RequestHandler} */
export const about = (req, res, _next) => {
  res.render('about', {
    meta: {
      title: 'About',
      url: req.urlObj,
      imageUrl: `${req.urlObj.origin}/icon.svg`,
      description:
        'Quetre is a libre front-end for Quora. See any answer without being tracked, without being required to log in, and without being bombarded by pesky ads.',
    },
  });
};

/** @type {import("express").RequestHandler} */
export const privacy = (req, res, _next) => {
  res.render('privacy', {
    meta: {
      title: 'Privacy',
      url: req.urlObj,
      imageUrl: `${req.urlObj.origin}/icon.svg`,
      description: 'Privacy Policy of Quetre, a libre front-end for Quora.',
    },
  });
};

export const archive = catchAsyncErrors(async (req, res, _next) => {
  const entries = await storeList();

  res.status(200).render('archive', {
    data: { entries },
    meta: {
      title: 'Archive',
      url: req.urlObj,
      imageUrl: `${req.urlObj.origin}/icon.svg`,
      description: 'Contenido guardado localmente.',
    },
  });
});

/** @type {import("express").RequestHandler} */
export const unimplemented = (req, res, _next) => {
  const data = {
    message: "This route isn't yet implemented. Check back sometime later!",
    statusCode: 501,
  };

  res.status(data.statusCode).render('error', {
    data,
    meta: {
      title: 'Not yet implemented',
      url: req.urlObj,
      imageUrl: `${req.urlObj.origin}/icon.svg`,
      description: data.message,
    },
  });
};

/** @type {import("express").RequestHandler} */
export const gone = (req, res, _next) => {
  const data = {
    message: "This route doesn't exist anymore.",
    statusCode: 410,
  };

  res.status(data.statusCode).render('error', {
    data,
    meta: {
      title: 'Gone',
      url: req.urlObj,
      imageUrl: `${req.urlObj.origin}/icon.svg`,
      description: data.message,
    },
  });
};