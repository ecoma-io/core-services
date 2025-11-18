/**
 * @fileoverview Cấu hình môi trường kiểm thử Jest để loại bỏ Stack Trace (dấu vết ngăn xếp)
 * không mong muốn từ các hàm console.log.
 *
 * @description
 * Vấn đề: Khi Jest chạy các bài kiểm thử, nó can thiệp (intercept) vào các hàm console
 * (như console.log, console.error, v.v.) và tự động thêm một Stack Trace không cần thiết
 * (ví dụ: "at TestEnvironment.log...") vào output, làm rối log và che khuất thông tin
 * quan trọng.
 *
 * Giải pháp: Bằng cách gán `global.console` bằng đối tượng `console` gốc của Node.js
 * (thay vì đối tượng console đã bị Jest sửa đổi/wrap), chúng ta có thể khôi phục lại
 * hành vi ghi log thuần túy, loại bỏ các chi tiết định dạng không mong muốn do Jest chèn vào.
 * khi cần loại bỏ log chỉ cần chạy jest --silent
 * * @usage
 * Đảm bảo file này được chỉ định trong cấu hình Jest của bạn thông qua thuộc tính
 * `setupFilesAfterEnv`.
 * * @example
 * // module.exports = {
 * //   setupFilesAfterEnv: ['@ecoma-io/jest-helpers/suppress-log-stack-trace'],
 * //   // ...
 * // };
 */
if (process.env['JEST_SILENT'] !== 'test') {
  global.console = require('console');
}
