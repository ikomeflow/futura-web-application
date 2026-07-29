# Futura Group Secure Portal

A secure property and rent portal with separate administrator and customer access.

## Features

- Customer self-signup, email/password login, and password reset
- Administrator access to all customer and payment records
- Customer self-service account deletion and administrator customer-account removal
- Customer access restricted to the signed-in customer's own profile and rent history
- Database-enforced Row Level Security
- Portfolio, tenant, property, and payment dashboards
- Responsive desktop and mobile layouts

## Secure setup

1. Create a Supabase project.
2. Open the Supabase SQL Editor and run `supabase-schema.sql`.
3. In Authentication, create the first user.
4. Promote that user to administrator using the final SQL statement in `supabase-schema.sql`.
5. Copy the project URL and publishable key into `config.js`.
6. Add the deployed website address to Supabase Authentication URL Configuration.
7. Enable email signups in Supabase Authentication. Each new signup automatically receives a restricted `customer` profile.

Only the publishable browser key belongs in `config.js`. Never place a Supabase secret or service-role key in this repository.

## Run locally

Serve the folder through a local web server. Authentication redirects do not work reliably when `index.html` is opened directly as a `file://` page.
