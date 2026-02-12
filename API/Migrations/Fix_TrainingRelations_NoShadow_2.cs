using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Migrations
{
    public partial class Fix_TrainingRelations_NoShadow_2 : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'TrainingAssignments'
          AND column_name  = 'TrainingId1'
    ) THEN
        ALTER TABLE ""TrainingAssignments"" DROP COLUMN ""TrainingId1"" CASCADE;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'TrainingAssignments'
          AND column_name  = 'TrainingIdId'
    ) THEN
        ALTER TABLE ""TrainingAssignments"" DROP COLUMN ""TrainingIdId"" CASCADE;
    END IF;
END $$;");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'TrainingAssignments'
          AND column_name  = 'TrainingId1'
    ) THEN
        ALTER TABLE ""TrainingAssignments"" ADD COLUMN ""TrainingId1"" integer NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'TrainingAssignments'
          AND column_name  = 'TrainingIdId'
    ) THEN
        ALTER TABLE ""TrainingAssignments"" ADD COLUMN ""TrainingIdId"" integer NULL;
    END IF;
END $$;");
        }
    }
}
