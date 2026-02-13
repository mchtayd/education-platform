// API/Program.cs
using API.Data;
using API.Models;
using API.Realtime;
using API.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;
using Microsoft.AspNetCore.Http.Features;

// ✅ EKLENDİ
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);

// ---------- DbContext ----------
builder.Services.AddDbContext<AppDbContext>(opt =>
{
    var cs = builder.Configuration.GetConnectionString("DefaultConnection")
        ?? throw new InvalidOperationException("DefaultConnection not found");
    opt.UseNpgsql(cs);
});

// ---------- CORS ----------
const string ClientCors = "ClientCors";
builder.Services.AddCors(opt =>
{
    opt.AddPolicy(ClientCors, p => p
        .WithOrigins(
            "http://localhost:3000",
            "http://localhost:5173"
        )
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials()
    );
});

// ---------- JWT ----------
builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));
builder.Services.AddScoped<ITokenService, TokenService>();

builder.Services.AddHostedService<TrainingAutoUnpublishService>();
builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();

var jwt = builder.Configuration.GetSection("Jwt").Get<JwtOptions>()!;
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.TokenValidationParameters = new()
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience
        };

        o.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var accessToken = ctx.Request.Query["access_token"];
                var path = ctx.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs/analysis"))
                    ctx.Token = accessToken;
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddSignalR(o => o.EnableDetailedErrors = true);
builder.Services.AddControllers();

// ---------- Upload (multipart) limitleri ----------
builder.Services.Configure<FormOptions>(o =>
{
    o.MultipartBodyLengthLimit = 1024L * 1024 * 500; // 500MB
});

// ---------- Swagger ----------
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "API", Version = "v1" });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Bearer {token}"
    });

    // ✅ HATA DÜZELTİLDİ: OpenApiReference.Reference yok
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

// ---------- Migrate + seed admin ----------
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();

    var adminEmail = builder.Configuration["SeedAdmin:Email"]?.Trim().ToLowerInvariant();
    var adminPass = builder.Configuration["SeedAdmin:Password"];
    var adminName = builder.Configuration["SeedAdmin:Name"] ?? "Admin";
    var adminSurname = builder.Configuration["SeedAdmin:Surname"] ?? "User";

    if (!string.IsNullOrWhiteSpace(adminEmail) && !await db.Users.AnyAsync(u => u.Email == adminEmail))
    {
        db.Users.Add(new User
        {
            Name = adminName,
            Surname = adminSurname,
            Email = adminEmail,
            Phone = "-",
            Institution = "-",
            BusinessAddress = "-",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(adminPass ?? "Admin*12345"),
            Role = "admin",
            CreatedAt = DateTimeOffset.UtcNow,
            KvkkAcceptedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();
    }
}

// ---------- Middleware sırası ----------
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.UseSwagger();
    app.UseSwaggerUI();
}

// app.UseHttpsRedirection();


// ✅ STATIC FILES GARANTİSİ (mevcut yapıyı bozmadan)
// app.UseStaticFiles();  // ❌ BUNU KALDIRDIK

var webRoot = app.Environment.WebRootPath;
if (string.IsNullOrWhiteSpace(webRoot))
    webRoot = Path.Combine(app.Environment.ContentRootPath, "wwwroot");

// Docker / prod’da klasör yoksa oluştur (static middleware'in boş kalmasını engeller)
Directory.CreateDirectory(webRoot);
Directory.CreateDirectory(Path.Combine(webRoot, "uploads", "trainings"));

// wwwroot altını (özellikle /uploads/...) servis et
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(webRoot),
    RequestPath = ""   // kökten servis: /uploads/... çalışır
});

app.UseRouting();

// CORS mutlaka Authentication/Authorization’dan ÖNCE
app.UseCors(ClientCors);

app.UseAuthentication();
app.UseAuthorization();

// Endpoint mapping
app.MapControllers().RequireCors(ClientCors);
app.MapHub<AnalysisHub>("/hubs/analysis").RequireCors(ClientCors);

app.Run();
