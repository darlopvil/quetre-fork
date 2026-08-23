import catchAsyncErrors from '../utils/catchAsyncErrors.js';
import { storeList } from '../utils/store.js';
import getSearch from '../fetchers/getSearch.js';

export const search = catchAsyncErrors(async (req, res, next) => {
  const { q, after, type, time } = req.query;

  if (!q) {
    return res.status(200).render('search', {
      data: { searchData: null, searchText: '' },
      meta: {
        title: 'Búsqueda',
        url: req.urlObj,
        imageUrl: `${req.urlObj.origin}/icon.svg`,
        description: 'Buscar en Quora.',
      },
    });
  }

  let data = res.locals.data;
  if (!data) data = await getSearch(q, { after, type, time });

  // res.locals.data guarda SIEMPRE la forma canonica: es lo que va a la cache
  // y lo que comparte con la API. La plantilla espera otra forma, asi que se
  // adapta en el render y no antes, o el formato dependeria de quien llegue
  // primero a la clave compartida.
  res.locals.data = data;
  res.locals.viewData = { searchData: data, searchText: q };
  res.locals.title = `Búsqueda: ${q}`;
  res.locals.description = `Resultados de búsqueda para ${q}.`;

  return next();
});

/** @type {import("express").RequestHandler} */
export const about = (req, res, _next) => {
  res.render('about', {
    meta: {
      title: 'Acerca de',
      url: req.urlObj,
      imageUrl: `${req.urlObj.origin}/icon.svg`,
      description: 'Quetre es un frontend libre para Quora. Lee cualquier respuesta sin rastreo, sin registro y sin anuncios.',
    },
  });
};

/** @type {import("express").RequestHandler} */
export const privacy = (req, res, _next) => {
  res.render('privacy', {
    meta: {
      title: 'Privacidad',
      url: req.urlObj,
      imageUrl: `${req.urlObj.origin}/icon.svg`,
      description: 'Política de privacidad de Quetre, un frontend libre para Quora.',
    },
  });
};

export const archive = catchAsyncErrors(async (req, res, _next) => {
  const entries = await storeList();

  res.status(200).render('archive', {
    data: { entries },
    meta: {
      title: 'Archivo',
      url: req.urlObj,
      imageUrl: `${req.urlObj.origin}/icon.svg`,
      description: 'Contenido guardado localmente.',
    },
  });
});

/** @type {import("express").RequestHandler} */
export const unimplemented = (req, res, _next) => {
  const data = {
    message: "Esta ruta aún no está implementada. ¡Intentálo más tarde!",
    statusCode: 501,
  };

  res.status(data.statusCode).render('error', {
    data,
    meta: {
      title: 'No implementado',
      url: req.urlObj,
      imageUrl: `${req.urlObj.origin}/icon.svg`,
      description: data.message,
    },
  });
};

/** @type {import("express").RequestHandler} */
export const gone = (req, res, _next) => {
  const data = {
    message: 'Esta ruta todavía no está implementada.',
    statusCode: 410,
  };

  res.status(data.statusCode).render('error', {
    data,
    meta: {
      title: 'No disponible',
      url: req.urlObj,
      imageUrl: `${req.urlObj.origin}/icon.svg`,
      description: data.message,
    },
  });
};