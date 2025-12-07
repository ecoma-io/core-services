Feature: IDM Command Liveness Health Check

  Relation: docs/iam/iam/idm-use-cases.md#idm-command-liveness-health-check

  Scenario: Kiểm tra liveness healthy trả về trạng thái healthy
		Given tiến trình dịch vụ `idm-command` đã được khởi động và đang chạy
		When operator hoặc orchestrator gọi `GET /health/liveness`
		Then dịch vụ trả về HTTP 200
		And nội dung response có trường `message` = "Service still alive"
