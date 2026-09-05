// 统一错误处理：挂在所有路由之后，捕获抛出的异常并返回统一 JSON
module.exports = (err, req, res, next) => {
  console.error(err)
  const status = err.status || 500
  res.status(status).json({ code: status, message: err.message || '服务器错误' })
}
