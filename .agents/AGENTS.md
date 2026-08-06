# Project Customizations and Guidelines

1. **Environment Variables**: Do not read or write permissions for `.env` files.
2. **Architecture**: We are developing an enterprise-grade project. Ensure everything is scalable and follows enterprise best practices.
3. **Frontend Components**: For each frontend component, try to keep everything in a single file (e.g., `signup/page.tsx`) instead of splitting it across multiple files unnecessarily.
4. **Database Queries**: Avoid using `SELECT *` commands. Instead, explicitly mention the specific column names in queries.
5. **Supabase Restrictions**: Do not call Supabase directly from the frontend. All database calls must be routed through the backend.
6. **Backend Structure**: For database functions, maintain a separate `db` folder in the backend that contains dedicated files for interacting with tables.
