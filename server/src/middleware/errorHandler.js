const errorHandler = (err, req, res, next) => {
  let status  = err.statusCode || 500;
  let message = err.message    || 'Internal Server Error';

  if (err.name === 'CastError')        { status = 400; message = `Invalid ${err.path}`; }
  if (err.code === 11000)              { status = 409; message = `${Object.keys(err.keyValue)[0]} already exists`; }
  if (err.name === 'ValidationError')  { status = 422; message = Object.values(err.errors).map(e=>e.message).join(', '); }
  if (err.name === 'JsonWebTokenError'){ status = 401; message = 'Invalid token'; }
  if (err.name === 'TokenExpiredError'){ status = 401; message = 'Token expired'; }

  if (process.env.NODE_ENV === 'development') console.error(err.stack);

  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { errorHandler, asyncHandler };
