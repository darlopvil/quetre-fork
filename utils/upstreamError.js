import AppError from './AppError.js';

/**
 * traduce un fallo de la petición a Quora en un AppError con causa identificable.
 * el código viaja en err.code para el log; el mensaje es el que ve el usuario.
 */
const upstreamError = err => {
    // ya es nuestro (p.ej. EMPTY_PAYLOAD): no lo re-envolvemos
    if (err.name === 'OperationalError') return err;

    const res = err.response;

    if (!res) {
        // sin response: puede ser fallo de red o un error de programación
        if (!err.isAxiosError) {
            const e = new AppError('Error interno.', 500);
            e.code = 'INTERNAL';
            e.detail = err.message;
            e.stack = err.stack;
            e.name = 'ProgrammingError';
            return e;
        }
        const e = new AppError('No se pudo contactar con Quora. Inténtalo de nuevo.', 502);
        e.code = 'NETWORK';
        e.detail = err.code || err.message;
        return e;
    }
    const isChallenge = res.status === 403 && res.headers?.['cf-mitigated'] === 'challenge';

    if (isChallenge) {
        // el interceptor ya reintentó tras re-acuñar: si llega aquí, la acuñación falló
        const e = new AppError(
            'Cloudflare está bloqueando esta instancia y no se pudo renovar el acceso.',
            503
        );
        e.code = 'CHALLENGE_UNSOLVED';
        return e;
    }

    if (res.status === 429) {
        const e = new AppError('Quora está limitando las peticiones. Prueba en un rato.', 503);
        e.code = 'RATE_LIMITED';
        return e;
    }

    if (res.status === 403) {
        const e = new AppError('Quora ha rechazado la petición.', 503);
        e.code = 'FORBIDDEN';
        return e;
    }

    if (res.status === 404) {
        const e = new AppError('No encontrado', 404);
        e.code = 'NOT_FOUND';
        return e;
    }

    if (res.status >= 500) {
        const e = new AppError('Quora está devolviendo errores. Inténtalo más tarde.', 502);
        e.code = 'UPSTREAM_ERROR';
        e.detail = `upstream ${res.status}`;
        return e;
    }

    const e = new AppError(`Respuesta inesperada de Quora (${res.status}).`, 502);
    e.code = 'UNEXPECTED';
    return e;
};

export default upstreamError;