using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Migrations
{
    /// <inheritdoc />
    public partial class SyncModel_202602182213 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ConsumedAt",
                table: "EmailVerifications");

            migrationBuilder.DropColumn(
                name: "ResetTokenExpiresAt",
                table: "EmailVerifications");

            migrationBuilder.RenameColumn(
                name: "VerifiedAt",
                table: "EmailVerifications",
                newName: "UsedAt");

            migrationBuilder.RenameColumn(
                name: "ResetTokenHash",
                table: "EmailVerifications",
                newName: "ResetHash");

            migrationBuilder.AlterColumn<string>(
                name: "Purpose",
                table: "EmailVerifications",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(32)",
                oldMaxLength: 32,
                oldDefaultValue: "register");

            migrationBuilder.AddColumn<string>(
                name: "ResetSalt",
                table: "EmailVerifications",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ResetSalt",
                table: "EmailVerifications");

            migrationBuilder.RenameColumn(
                name: "UsedAt",
                table: "EmailVerifications",
                newName: "VerifiedAt");

            migrationBuilder.RenameColumn(
                name: "ResetHash",
                table: "EmailVerifications",
                newName: "ResetTokenHash");

            migrationBuilder.AlterColumn<string>(
                name: "Purpose",
                table: "EmailVerifications",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "register",
                oldClrType: typeof(string),
                oldType: "character varying(40)",
                oldMaxLength: 40);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ConsumedAt",
                table: "EmailVerifications",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ResetTokenExpiresAt",
                table: "EmailVerifications",
                type: "timestamp with time zone",
                nullable: true);
        }
    }
}
