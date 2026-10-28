import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "unaccent"`);

    // organizations
    await queryRunner.query(`
      CREATE TABLE "organizations" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "code" VARCHAR(20) NOT NULL UNIQUE,
        "name_th" VARCHAR(200) NOT NULL,
        "name_en" VARCHAR(200),
        "type" VARCHAR(50) NOT NULL CHECK (type IN ('อบต','เทศบาลตำบล','เทศบาลเมือง','เทศบาลนคร')),
        "province" VARCHAR(100) NOT NULL,
        "district" VARCHAR(100) NOT NULL,
        "sub_district" VARCHAR(100) NOT NULL,
        "address" TEXT,
        "phone" VARCHAR(20),
        "fax" VARCHAR(20),
        "email" VARCHAR(100),
        "website" VARCHAR(200),
        "logo_url" VARCHAR(500),
        "header_text" TEXT,
        "is_active" BOOLEAN DEFAULT TRUE,
        "metadata" JSONB DEFAULT '{}',
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "updated_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    // departments
    await queryRunner.query(`
      CREATE TABLE "departments" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "organization_id" UUID NOT NULL REFERENCES organizations(id),
        "code" VARCHAR(20) NOT NULL,
        "name_th" VARCHAR(200) NOT NULL,
        "name_en" VARCHAR(200),
        "description" TEXT,
        "head_user_id" UUID,
        "order_no" SMALLINT DEFAULT 0,
        "is_active" BOOLEAN DEFAULT TRUE,
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "updated_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "deleted_at" TIMESTAMPTZ,
        UNIQUE (organization_id, code)
      )
    `);

    // divisions
    await queryRunner.query(`
      CREATE TABLE "divisions" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "department_id" UUID NOT NULL REFERENCES departments(id),
        "code" VARCHAR(20) NOT NULL,
        "name_th" VARCHAR(200) NOT NULL,
        "name_en" VARCHAR(200),
        "description" TEXT,
        "head_user_id" UUID,
        "order_no" SMALLINT DEFAULT 0,
        "is_active" BOOLEAN DEFAULT TRUE,
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "updated_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "deleted_at" TIMESTAMPTZ,
        UNIQUE (department_id, code)
      )
    `);

    // users
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "organization_id" UUID NOT NULL REFERENCES organizations(id),
        "employee_id" UUID,
        "username" VARCHAR(100) NOT NULL UNIQUE,
        "email" VARCHAR(200) NOT NULL UNIQUE,
        "phone" VARCHAR(20),
        "password_hash" VARCHAR(255) NOT NULL,
        "full_name_th" VARCHAR(200) NOT NULL,
        "full_name_en" VARCHAR(200),
        "title_th" VARCHAR(50),
        "prefix" VARCHAR(20),
        "avatar_url" VARCHAR(500),
        "department_id" UUID REFERENCES departments(id),
        "division_id" UUID REFERENCES divisions(id),
        "position_name" VARCHAR(200),
        "is_active" BOOLEAN DEFAULT TRUE,
        "is_verified" BOOLEAN DEFAULT FALSE,
        "is_2fa_enabled" BOOLEAN DEFAULT FALSE,
        "two_fa_secret" VARCHAR(255),
        "failed_login_count" SMALLINT DEFAULT 0,
        "locked_until" TIMESTAMPTZ,
        "password_changed_at" TIMESTAMPTZ,
        "last_login_at" TIMESTAMPTZ,
        "last_login_ip" INET,
        "line_user_id" VARCHAR(100),
        "line_notify_token" VARCHAR(255),
        "metadata" JSONB DEFAULT '{}',
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "updated_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "deleted_at" TIMESTAMPTZ,
        "created_by" UUID
      )
    `);

    // roles
    await queryRunner.query(`
      CREATE TABLE "roles" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "organization_id" UUID,
        "name" VARCHAR(100) NOT NULL,
        "name_th" VARCHAR(200) NOT NULL,
        "description" TEXT,
        "is_system" BOOLEAN DEFAULT FALSE,
        "level" SMALLINT DEFAULT 0,
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "updated_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    // permissions
    await queryRunner.query(`
      CREATE TABLE "permissions" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "module" VARCHAR(100) NOT NULL,
        "action" VARCHAR(100) NOT NULL,
        "subject" VARCHAR(100) NOT NULL,
        "description" TEXT,
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        UNIQUE (module, action, subject)
      )
    `);

    // role_permissions
    await queryRunner.query(`
      CREATE TABLE "role_permissions" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "role_id" UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        "permission_id" UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        UNIQUE (role_id, permission_id)
      )
    `);

    // user_roles
    await queryRunner.query(`
      CREATE TABLE "user_roles" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "user_id" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "role_id" UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        "assigned_by" UUID,
        "assigned_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "expires_at" TIMESTAMPTZ,
        UNIQUE (user_id, role_id)
      )
    `);

    // refresh_tokens
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "user_id" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "token_hash" VARCHAR(255) NOT NULL UNIQUE,
        "device_info" TEXT,
        "ip_address" INET,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "revoked_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    // document_number_sequences
    await queryRunner.query(`
      CREATE TABLE "document_number_sequences" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "organization_id" UUID NOT NULL REFERENCES organizations(id),
        "doc_type" VARCHAR(50) NOT NULL,
        "year" SMALLINT NOT NULL,
        "prefix" VARCHAR(20),
        "current_number" INTEGER DEFAULT 0,
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "updated_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        UNIQUE (organization_id, doc_type, year)
      )
    `);

    // incoming_documents
    await queryRunner.query(`
      CREATE TABLE "incoming_documents" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "organization_id" UUID NOT NULL REFERENCES organizations(id),
        "receive_number" VARCHAR(50) NOT NULL,
        "external_doc_number" VARCHAR(100),
        "received_at" TIMESTAMPTZ NOT NULL,
        "doc_date" DATE,
        "subject" VARCHAR(500) NOT NULL,
        "body" TEXT,
        "urgency_level" VARCHAR(20) DEFAULT 'ปกติ',
        "sender_org" VARCHAR(300),
        "sender_name" VARCHAR(200),
        "receiver_dept_id" UUID REFERENCES departments(id),
        "assigned_to" UUID REFERENCES users(id),
        "status" VARCHAR(50) DEFAULT 'รอรับ',
        "current_step" SMALLINT DEFAULT 1,
        "action_note" TEXT,
        "due_date" DATE,
        "completed_at" TIMESTAMPTZ,
        "created_by" UUID NOT NULL REFERENCES users(id),
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "updated_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "deleted_at" TIMESTAMPTZ
      )
    `);

    // outgoing_documents
    await queryRunner.query(`
      CREATE TABLE "outgoing_documents" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "organization_id" UUID NOT NULL REFERENCES organizations(id),
        "doc_number" VARCHAR(50) NOT NULL,
        "doc_date" DATE NOT NULL,
        "subject" VARCHAR(500) NOT NULL,
        "body" TEXT NOT NULL,
        "urgency_level" VARCHAR(20) DEFAULT 'ปกติ',
        "recipient_name" VARCHAR(300) NOT NULL,
        "recipient_org" VARCHAR(300),
        "recipient_address" TEXT,
        "signer_id" UUID REFERENCES users(id),
        "signed_at" TIMESTAMPTZ,
        "pdf_url" VARCHAR(500),
        "status" VARCHAR(50) DEFAULT 'ร่าง',
        "reply_to_id" UUID REFERENCES incoming_documents(id),
        "department_id" UUID REFERENCES departments(id),
        "created_by" UUID NOT NULL REFERENCES users(id),
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "updated_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "deleted_at" TIMESTAMPTZ
      )
    `);

    // document_workflow_logs
    await queryRunner.query(`
      CREATE TABLE "document_workflow_logs" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "doc_type" VARCHAR(20) NOT NULL,
        "document_id" UUID NOT NULL,
        "step_number" SMALLINT NOT NULL,
        "step_name" VARCHAR(100) NOT NULL,
        "actor_id" UUID NOT NULL REFERENCES users(id),
        "action" VARCHAR(50) NOT NULL,
        "note" TEXT,
        "from_status" VARCHAR(50),
        "to_status" VARCHAR(50),
        "acted_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "ip_address" INET
      )
    `);

    // approval_request_types
    await queryRunner.query(`
      CREATE TABLE "approval_request_types" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "organization_id" UUID,
        "code" VARCHAR(50) NOT NULL UNIQUE,
        "name_th" VARCHAR(200) NOT NULL,
        "description" TEXT,
        "form_template" JSONB DEFAULT '{}',
        "approval_levels" SMALLINT DEFAULT 4,
        "is_active" BOOLEAN DEFAULT TRUE,
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    // approval_requests
    await queryRunner.query(`
      CREATE TABLE "approval_requests" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "organization_id" UUID NOT NULL REFERENCES organizations(id),
        "request_number" VARCHAR(50) NOT NULL,
        "type_id" UUID NOT NULL REFERENCES approval_request_types(id),
        "requester_id" UUID NOT NULL REFERENCES users(id),
        "department_id" UUID NOT NULL REFERENCES departments(id),
        "division_id" UUID REFERENCES divisions(id),
        "subject" VARCHAR(500) NOT NULL,
        "body" TEXT NOT NULL,
        "form_data" JSONB DEFAULT '{}',
        "status" VARCHAR(50) DEFAULT 'ร่าง',
        "current_approver_id" UUID REFERENCES users(id),
        "current_level" SMALLINT DEFAULT 1,
        "total_levels" SMALLINT DEFAULT 4,
        "submitted_at" TIMESTAMPTZ,
        "approved_at" TIMESTAMPTZ,
        "rejected_at" TIMESTAMPTZ,
        "due_date" DATE,
        "pdf_url" VARCHAR(500),
        "budget_amount" NUMERIC(15,2),
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "updated_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "deleted_at" TIMESTAMPTZ
      )
    `);

    // approval_workflow_steps
    await queryRunner.query(`
      CREATE TABLE "approval_workflow_steps" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "request_id" UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
        "level" SMALLINT NOT NULL,
        "level_name" VARCHAR(100) NOT NULL,
        "approver_id" UUID NOT NULL REFERENCES users(id),
        "status" VARCHAR(30) DEFAULT 'รอดำเนินการ',
        "comment" TEXT,
        "acted_at" TIMESTAMPTZ,
        "notified_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        UNIQUE (request_id, level)
      )
    `);

    // approval_workflow_logs
    await queryRunner.query(`
      CREATE TABLE "approval_workflow_logs" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "request_id" UUID NOT NULL REFERENCES approval_requests(id),
        "step_id" UUID REFERENCES approval_workflow_steps(id),
        "actor_id" UUID NOT NULL REFERENCES users(id),
        "action" VARCHAR(30) NOT NULL,
        "comment" TEXT,
        "from_status" VARCHAR(50),
        "to_status" VARCHAR(50),
        "acted_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "ip_address" INET,
        "user_agent" TEXT
      )
    `);

    // user_signatures
    await queryRunner.query(`
      CREATE TABLE "user_signatures" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "user_id" UUID NOT NULL REFERENCES users(id),
        "sig_type" VARCHAR(30) NOT NULL,
        "image_url" VARCHAR(500),
        "image_data" TEXT,
        "certificate_data" TEXT,
        "private_key_hash" VARCHAR(255),
        "is_default" BOOLEAN DEFAULT FALSE,
        "is_active" BOOLEAN DEFAULT TRUE,
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "updated_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    // signature_logs
    await queryRunner.query(`
      CREATE TABLE "signature_logs" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "user_id" UUID NOT NULL REFERENCES users(id),
        "signature_id" UUID NOT NULL REFERENCES user_signatures(id),
        "document_type" VARCHAR(50) NOT NULL,
        "document_id" UUID NOT NULL,
        "document_title" VARCHAR(500),
        "signed_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "ip_address" INET NOT NULL,
        "user_agent" TEXT,
        "browser" VARCHAR(200),
        "device_type" VARCHAR(50),
        "os" VARCHAR(100),
        "page_number" SMALLINT,
        "position_x" REAL,
        "position_y" REAL,
        "width" REAL,
        "height" REAL,
        "document_hash" VARCHAR(64),
        "metadata" JSONB DEFAULT '{}'
      )
    `);

    // document_categories
    await queryRunner.query(`
      CREATE TABLE "document_categories" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "organization_id" UUID,
        "parent_id" UUID REFERENCES document_categories(id),
        "code" VARCHAR(50) NOT NULL,
        "name_th" VARCHAR(200) NOT NULL,
        "description" TEXT,
        "icon" VARCHAR(50),
        "color" VARCHAR(20),
        "order_no" SMALLINT DEFAULT 0,
        "is_active" BOOLEAN DEFAULT TRUE,
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    // documents
    await queryRunner.query(`
      CREATE TABLE "documents" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "organization_id" UUID NOT NULL REFERENCES organizations(id),
        "category_id" UUID REFERENCES document_categories(id),
        "doc_number" VARCHAR(100),
        "title" VARCHAR(500) NOT NULL,
        "description" TEXT,
        "file_url" VARCHAR(500) NOT NULL,
        "file_name" VARCHAR(300) NOT NULL,
        "file_size" BIGINT,
        "mime_type" VARCHAR(100),
        "ocr_text" TEXT,
        "ocr_processed_at" TIMESTAMPTZ,
        "search_vector" TSVECTOR,
        "doc_year" SMALLINT,
        "doc_date" DATE,
        "tags" TEXT[] DEFAULT '{}',
        "access_level" VARCHAR(30) DEFAULT 'internal',
        "department_id" UUID REFERENCES departments(id),
        "source_type" VARCHAR(50),
        "source_id" UUID,
        "is_active" BOOLEAN DEFAULT TRUE,
        "download_count" INTEGER DEFAULT 0,
        "view_count" INTEGER DEFAULT 0,
        "created_by" UUID NOT NULL REFERENCES users(id),
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "updated_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "deleted_at" TIMESTAMPTZ
      )
    `);

    // document_versions
    await queryRunner.query(`
      CREATE TABLE "document_versions" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "document_id" UUID NOT NULL REFERENCES documents(id),
        "version_number" SMALLINT NOT NULL,
        "file_url" VARCHAR(500) NOT NULL,
        "file_size" BIGINT,
        "change_note" TEXT,
        "created_by" UUID NOT NULL REFERENCES users(id),
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        UNIQUE (document_id, version_number)
      )
    `);

    // file_uploads
    await queryRunner.query(`
      CREATE TABLE "file_uploads" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "original_name" VARCHAR(300) NOT NULL,
        "stored_name" VARCHAR(300) NOT NULL,
        "mime_type" VARCHAR(100) NOT NULL,
        "file_size" BIGINT NOT NULL,
        "bucket" VARCHAR(100) NOT NULL,
        "object_key" VARCHAR(500) NOT NULL,
        "url" VARCHAR(500),
        "ref_type" VARCHAR(100),
        "ref_id" UUID,
        "is_public" BOOLEAN DEFAULT FALSE,
        "is_orphan" BOOLEAN DEFAULT FALSE,
        "uploaded_by" UUID NOT NULL REFERENCES users(id),
        "uploaded_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "deleted_at" TIMESTAMPTZ
      )
    `);

    // notifications
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "organization_id" UUID NOT NULL REFERENCES organizations(id),
        "recipient_id" UUID NOT NULL REFERENCES users(id),
        "type" VARCHAR(100) NOT NULL,
        "title" VARCHAR(300) NOT NULL,
        "body" TEXT NOT NULL,
        "action_url" VARCHAR(500),
        "ref_type" VARCHAR(100),
        "ref_id" UUID,
        "channel" VARCHAR(20) DEFAULT 'in_app',
        "is_read" BOOLEAN DEFAULT FALSE,
        "read_at" TIMESTAMPTZ,
        "sent_at" TIMESTAMPTZ,
        "failed_at" TIMESTAMPTZ,
        "error_message" TEXT,
        "priority" VARCHAR(20) DEFAULT 'normal',
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    // notification_preferences
    await queryRunner.query(`
      CREATE TABLE "notification_preferences" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "user_id" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "notification_type" VARCHAR(100) NOT NULL,
        "via_in_app" BOOLEAN DEFAULT TRUE,
        "via_email" BOOLEAN DEFAULT TRUE,
        "via_line" BOOLEAN DEFAULT FALSE,
        "updated_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        UNIQUE (user_id, notification_type)
      )
    `);

    // employee_positions
    await queryRunner.query(`
      CREATE TABLE "employee_positions" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "organization_id" UUID NOT NULL REFERENCES organizations(id),
        "code" VARCHAR(50) NOT NULL,
        "name_th" VARCHAR(200) NOT NULL,
        "name_en" VARCHAR(200),
        "level" SMALLINT,
        "salary_min" NUMERIC(12,2),
        "salary_max" NUMERIC(12,2),
        "is_active" BOOLEAN DEFAULT TRUE,
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    // employees
    await queryRunner.query(`
      CREATE TABLE "employees" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "organization_id" UUID NOT NULL REFERENCES organizations(id),
        "user_id" UUID UNIQUE REFERENCES users(id),
        "employee_code" VARCHAR(50) NOT NULL UNIQUE,
        "title" VARCHAR(20),
        "first_name_th" VARCHAR(100) NOT NULL,
        "last_name_th" VARCHAR(100) NOT NULL,
        "first_name_en" VARCHAR(100),
        "last_name_en" VARCHAR(100),
        "national_id" VARCHAR(13) NOT NULL UNIQUE,
        "birth_date" DATE,
        "gender" VARCHAR(10),
        "nationality" VARCHAR(50) DEFAULT 'ไทย',
        "religion" VARCHAR(50),
        "address" TEXT,
        "phone" VARCHAR(20),
        "emergency_contact" VARCHAR(200),
        "emergency_phone" VARCHAR(20),
        "department_id" UUID REFERENCES departments(id),
        "division_id" UUID REFERENCES divisions(id),
        "position_id" UUID REFERENCES employee_positions(id),
        "position_name" VARCHAR(200),
        "employee_type" VARCHAR(50) NOT NULL,
        "hire_date" DATE NOT NULL,
        "probation_end_date" DATE,
        "contract_end_date" DATE,
        "resign_date" DATE,
        "salary" NUMERIC(12,2),
        "status" VARCHAR(30) DEFAULT 'ปฏิบัติงาน',
        "photo_url" VARCHAR(500),
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "updated_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "deleted_at" TIMESTAMPTZ
      )
    `);

    // employee_education, employee_training, leave_types, leave_quotas, leave_requests,
    // leave_approval_logs, meetings, meeting_attendees, meeting_agenda_items, meeting_resolutions,
    // asset_categories, assets, asset_transfers, asset_inspections,
    // complaint_categories, complaints, complaint_workflow_logs,
    // audit_logs, system_settings

    await queryRunner.query(`
      CREATE TABLE "employee_education" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "employee_id" UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        "degree" VARCHAR(100) NOT NULL,
        "major" VARCHAR(200),
        "institution" VARCHAR(300) NOT NULL,
        "graduation_year" SMALLINT,
        "gpa" NUMERIC(3,2),
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "employee_training" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "employee_id" UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        "course_name" VARCHAR(300) NOT NULL,
        "organizer" VARCHAR(300),
        "location" VARCHAR(300),
        "start_date" DATE NOT NULL,
        "end_date" DATE,
        "hours" SMALLINT,
        "certificate_url" VARCHAR(500),
        "note" TEXT,
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "leave_types" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "organization_id" UUID,
        "code" VARCHAR(30) NOT NULL UNIQUE,
        "name_th" VARCHAR(100) NOT NULL,
        "max_days_year" SMALLINT,
        "requires_doc" BOOLEAN DEFAULT FALSE,
        "advance_days" SMALLINT DEFAULT 0,
        "is_active" BOOLEAN DEFAULT TRUE,
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "leave_quotas" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "employee_id" UUID NOT NULL REFERENCES employees(id),
        "leave_type_id" UUID NOT NULL REFERENCES leave_types(id),
        "year" SMALLINT NOT NULL,
        "total_days" NUMERIC(5,1) NOT NULL,
        "used_days" NUMERIC(5,1) DEFAULT 0,
        "updated_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        UNIQUE (employee_id, leave_type_id, year)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "leave_requests" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "organization_id" UUID NOT NULL REFERENCES organizations(id),
        "request_number" VARCHAR(50) NOT NULL,
        "employee_id" UUID NOT NULL REFERENCES employees(id),
        "leave_type_id" UUID NOT NULL REFERENCES leave_types(id),
        "start_date" DATE NOT NULL,
        "end_date" DATE NOT NULL,
        "total_days" NUMERIC(5,1) NOT NULL,
        "reason" TEXT NOT NULL,
        "contact_during" VARCHAR(200),
        "delegate_id" UUID REFERENCES employees(id),
        "status" VARCHAR(30) DEFAULT 'รอการอนุมัติ',
        "current_approver_id" UUID REFERENCES users(id),
        "submitted_at" TIMESTAMPTZ,
        "approved_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "updated_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "leave_approval_logs" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "request_id" UUID NOT NULL REFERENCES leave_requests(id),
        "approver_id" UUID NOT NULL REFERENCES users(id),
        "level" SMALLINT NOT NULL,
        "level_name" VARCHAR(100),
        "action" VARCHAR(30) NOT NULL,
        "comment" TEXT,
        "acted_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "meetings" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "organization_id" UUID NOT NULL REFERENCES organizations(id),
        "meeting_number" VARCHAR(50) NOT NULL,
        "title" VARCHAR(500) NOT NULL,
        "type" VARCHAR(50) DEFAULT 'ประชุมทั่วไป',
        "location" VARCHAR(300),
        "is_online" BOOLEAN DEFAULT FALSE,
        "meeting_url" VARCHAR(500),
        "start_datetime" TIMESTAMPTZ NOT NULL,
        "end_datetime" TIMESTAMPTZ NOT NULL,
        "actual_start" TIMESTAMPTZ,
        "actual_end" TIMESTAMPTZ,
        "chair_id" UUID NOT NULL REFERENCES users(id),
        "secretary_id" UUID REFERENCES users(id),
        "status" VARCHAR(30) DEFAULT 'กำหนดการ',
        "minutes_text" TEXT,
        "minutes_pdf_url" VARCHAR(500),
        "minutes_approved_at" TIMESTAMPTZ,
        "department_id" UUID REFERENCES departments(id),
        "created_by" UUID NOT NULL REFERENCES users(id),
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "updated_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "deleted_at" TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "meeting_attendees" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "meeting_id" UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
        "user_id" UUID NOT NULL REFERENCES users(id),
        "role" VARCHAR(50) DEFAULT 'ผู้เข้าร่วม',
        "is_confirmed" BOOLEAN DEFAULT FALSE,
        "confirmed_at" TIMESTAMPTZ,
        "is_attended" BOOLEAN,
        "attended_at" TIMESTAMPTZ,
        "invite_sent_at" TIMESTAMPTZ,
        "note" TEXT,
        UNIQUE (meeting_id, user_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "meeting_agenda_items" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "meeting_id" UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
        "order_no" SMALLINT NOT NULL,
        "title" VARCHAR(500) NOT NULL,
        "description" TEXT,
        "presenter_id" UUID REFERENCES users(id),
        "duration_min" SMALLINT,
        "type" VARCHAR(50) DEFAULT 'แจ้งเพื่อทราบ',
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "meeting_resolutions" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "meeting_id" UUID NOT NULL REFERENCES meetings(id),
        "agenda_item_id" UUID REFERENCES meeting_agenda_items(id),
        "order_no" SMALLINT NOT NULL,
        "resolution_text" TEXT NOT NULL,
        "responsible_id" UUID REFERENCES users(id),
        "due_date" DATE,
        "status" VARCHAR(30) DEFAULT 'รอดำเนินการ',
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "asset_categories" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "organization_id" UUID,
        "parent_id" UUID REFERENCES asset_categories(id),
        "code" VARCHAR(50) NOT NULL,
        "name_th" VARCHAR(200) NOT NULL,
        "depreciation_years" SMALLINT DEFAULT 5,
        "is_active" BOOLEAN DEFAULT TRUE,
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "assets" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "organization_id" UUID NOT NULL REFERENCES organizations(id),
        "category_id" UUID REFERENCES asset_categories(id),
        "asset_code" VARCHAR(100) NOT NULL UNIQUE,
        "qr_code" VARCHAR(500),
        "qr_code_url" VARCHAR(500),
        "name" VARCHAR(300) NOT NULL,
        "description" TEXT,
        "brand" VARCHAR(100),
        "model" VARCHAR(100),
        "serial_number" VARCHAR(200),
        "purchase_date" DATE,
        "purchase_price" NUMERIC(15,2),
        "supplier" VARCHAR(300),
        "warranty_expire" DATE,
        "department_id" UUID REFERENCES departments(id),
        "location" VARCHAR(300),
        "custodian_id" UUID REFERENCES employees(id),
        "status" VARCHAR(50) DEFAULT 'ใช้งาน',
        "photo_url" VARCHAR(500),
        "current_value" NUMERIC(15,2),
        "depreciation_rate" NUMERIC(5,2),
        "notes" TEXT,
        "created_by" UUID NOT NULL REFERENCES users(id),
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "updated_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "deleted_at" TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "asset_transfers" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "asset_id" UUID NOT NULL REFERENCES assets(id),
        "from_department_id" UUID REFERENCES departments(id),
        "to_department_id" UUID NOT NULL REFERENCES departments(id),
        "from_custodian_id" UUID REFERENCES employees(id),
        "to_custodian_id" UUID NOT NULL REFERENCES employees(id),
        "transfer_date" DATE NOT NULL,
        "reason" TEXT,
        "approved_by" UUID REFERENCES users(id),
        "created_by" UUID NOT NULL REFERENCES users(id),
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "asset_inspections" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "asset_id" UUID NOT NULL REFERENCES assets(id),
        "inspection_date" DATE NOT NULL,
        "inspector_id" UUID NOT NULL REFERENCES users(id),
        "condition" VARCHAR(30) NOT NULL,
        "note" TEXT,
        "photo_url" VARCHAR(500),
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "complaint_categories" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "organization_id" UUID,
        "code" VARCHAR(50) NOT NULL,
        "name_th" VARCHAR(200) NOT NULL,
        "icon" VARCHAR(50),
        "color" VARCHAR(20),
        "responsible_dept_id" UUID REFERENCES departments(id),
        "sla_days" SMALLINT DEFAULT 15,
        "is_active" BOOLEAN DEFAULT TRUE,
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "complaints" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "organization_id" UUID NOT NULL REFERENCES organizations(id),
        "complaint_number" VARCHAR(50) NOT NULL UNIQUE,
        "tracking_code" VARCHAR(20) NOT NULL UNIQUE,
        "category_id" UUID REFERENCES complaint_categories(id),
        "is_anonymous" BOOLEAN DEFAULT FALSE,
        "complainant_name" VARCHAR(200),
        "complainant_phone" VARCHAR(20),
        "complainant_email" VARCHAR(200),
        "complainant_address" TEXT,
        "user_id" UUID REFERENCES users(id),
        "subject" VARCHAR(500) NOT NULL,
        "description" TEXT NOT NULL,
        "location" TEXT,
        "incident_date" DATE,
        "status" VARCHAR(50) DEFAULT 'รอรับเรื่อง',
        "priority" VARCHAR(20) DEFAULT 'ปกติ',
        "assigned_dept_id" UUID REFERENCES departments(id),
        "assigned_user_id" UUID REFERENCES users(id),
        "assigned_at" TIMESTAMPTZ,
        "due_date" DATE,
        "result_summary" TEXT,
        "completed_at" TIMESTAMPTZ,
        "satisfaction_score" SMALLINT,
        "satisfaction_note" TEXT,
        "rated_at" TIMESTAMPTZ,
        "received_by" UUID REFERENCES users(id),
        "received_at" TIMESTAMPTZ DEFAULT NOW(),
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "updated_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "complaint_workflow_logs" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "complaint_id" UUID NOT NULL REFERENCES complaints(id),
        "actor_id" UUID REFERENCES users(id),
        "action" VARCHAR(50) NOT NULL,
        "note" TEXT,
        "from_status" VARCHAR(50),
        "to_status" VARCHAR(50),
        "is_visible_to_public" BOOLEAN DEFAULT TRUE,
        "acted_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "organization_id" UUID,
        "user_id" UUID,
        "user_name" VARCHAR(200),
        "ip_address" INET,
        "user_agent" TEXT,
        "action" VARCHAR(100) NOT NULL,
        "module" VARCHAR(100) NOT NULL,
        "resource_type" VARCHAR(100),
        "resource_id" UUID,
        "resource_title" VARCHAR(500),
        "old_values" JSONB,
        "new_values" JSONB,
        "status" VARCHAR(20) DEFAULT 'success',
        "error_message" TEXT,
        "acted_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "system_settings" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "organization_id" UUID,
        "key" VARCHAR(200) NOT NULL,
        "value" TEXT,
        "value_json" JSONB,
        "description" TEXT,
        "is_public" BOOLEAN DEFAULT FALSE,
        "updated_by" UUID REFERENCES users(id),
        "updated_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        UNIQUE (organization_id, key)
      )
    `);

    // Create Indexes
    await queryRunner.query(`CREATE INDEX idx_users_org ON users(organization_id)`);
    await queryRunner.query(`CREATE INDEX idx_users_dept ON users(department_id)`);
    await queryRunner.query(`CREATE INDEX idx_incoming_org ON incoming_documents(organization_id)`);
    await queryRunner.query(`CREATE INDEX idx_incoming_status ON incoming_documents(status)`);
    await queryRunner.query(`CREATE INDEX idx_incoming_assigned ON incoming_documents(assigned_to)`);
    await queryRunner.query(`CREATE INDEX idx_approval_requester ON approval_requests(requester_id)`);
    await queryRunner.query(`CREATE INDEX idx_approval_status ON approval_requests(status)`);
    await queryRunner.query(`CREATE INDEX idx_approval_approver ON approval_requests(current_approver_id)`);
    await queryRunner.query(`CREATE INDEX idx_notif_recipient ON notifications(recipient_id, is_read, created_at DESC)`);
    await queryRunner.query(`CREATE INDEX idx_audit_user ON audit_logs(user_id, acted_at DESC)`);
    await queryRunner.query(`CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id)`);
    await queryRunner.query(`CREATE INDEX idx_complaint_tracking ON complaints(tracking_code)`);
    await queryRunner.query(`CREATE INDEX idx_asset_code ON assets(asset_code)`);
    await queryRunner.query(`CREATE INDEX idx_documents_fts ON documents USING GIN(search_vector)`);
    await queryRunner.query(`CREATE INDEX idx_documents_tags ON documents USING GIN(tags)`);

    // FTS Trigger
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION documents_search_update()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.search_vector :=
          setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
          setweight(to_tsvector('simple', coalesce(NEW.doc_number, '')), 'B') ||
          setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'C') ||
          setweight(to_tsvector('simple', coalesce(NEW.ocr_text, '')), 'D');
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER documents_search_trigger
      BEFORE INSERT OR UPDATE ON documents
      FOR EACH ROW EXECUTE FUNCTION documents_search_update()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'system_settings', 'audit_logs', 'complaint_workflow_logs', 'complaints', 'complaint_categories',
      'asset_inspections', 'asset_transfers', 'assets', 'asset_categories',
      'meeting_resolutions', 'meeting_agenda_items', 'meeting_attendees', 'meetings',
      'leave_approval_logs', 'leave_requests', 'leave_quotas', 'leave_types',
      'employee_training', 'employee_education', 'employees', 'employee_positions',
      'notification_preferences', 'notifications', 'file_uploads', 'document_versions', 'documents', 'document_categories',
      'signature_logs', 'user_signatures', 'approval_workflow_logs', 'approval_workflow_steps',
      'approval_requests', 'approval_request_types', 'document_workflow_logs',
      'outgoing_documents', 'incoming_documents', 'document_number_sequences',
      'refresh_tokens', 'user_roles', 'role_permissions', 'permissions', 'roles',
      'users', 'divisions', 'departments', 'organizations',
    ];
    for (const table of tables) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    }
  }
}
