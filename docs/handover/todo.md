# TODO (Current)

## P0
1. 给 API 增加 DTO 层（避免直接返回 raw_json）
2. 增加统一错误码与分页响应模型
3. 增加数据完整性检查接口（null/duplicate/orphan）

## P1
1. 搭建 Next.js 前端骨架并接入以下页面：
   - Dashboard
   - Students
   - Orders
   - Hour Cost Flows
   - Rollcalls
2. 前端筛选器与服务端参数对齐

## P2
1. 增加集成测试（核心列表接口 + 过滤参数）
2. 添加导入后校验报告自动生成任务

## Notes for next agent
- DB 连接方式见 `docs/runbooks/postgres-docker-setup.md`
- 当前实现状态见 `docs/03-delivery/backend-implementation-status.md`
