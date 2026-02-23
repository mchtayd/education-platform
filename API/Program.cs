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
using API.Options;
using Microsoft.Extensions.Options;

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

builder.Services.Configure<OllamaOptions>(builder.Configuration.GetSection("Ollama"));
builder.Services.AddHttpClient<OllamaClient>((sp, client) =>
{
    var opt = sp.GetRequiredService<IOptions<OllamaOptions>>().Value;
    client.BaseAddress = new Uri(opt.BaseUrl);
    client.Timeout = TimeSpan.FromMinutes(5);
});

builder.Services.AddSingleton<PdfTextExtractor>();
builder.Services.AddScoped<AiRagService>();

// ---------- AI Providers (Ollama + Gemini) ----------
builder.Services.Configure<AiProviderOptions>(builder.Configuration.GetSection("AI"));
builder.Services.Configure<GeminiOptions>(builder.Configuration.GetSection("Gemini"));

// Mevcut Ollama client'in aynen kalıyor
builder.Services.Configure<OllamaOptions>(builder.Configuration.GetSection("Ollama"));
builder.Services.AddHttpClient<OllamaClient>((sp, client) =>
{
    var opt = sp.GetRequiredService<IOptions<OllamaOptions>>().Value;
    client.BaseAddress = new Uri(opt.BaseUrl);
    client.Timeout = TimeSpan.FromMinutes(5);
});

// ✅ Yeni Gemini client
builder.Services.AddHttpClient<GeminiClient>((sp, client) =>
{
    var opt = sp.GetRequiredService<IOptions<GeminiOptions>>().Value;
    client.BaseAddress = new Uri(opt.BaseUrl);
    client.Timeout = TimeSpan.FromSeconds(opt.TimeoutSeconds <= 0 ? 120 : opt.TimeoutSeconds);
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


// Provider implementations
builder.Services.AddScoped<OllamaAiProvider>();
builder.Services.AddScoped<GeminiAiProvider>();
builder.Services.AddScoped<IAiProviderFactory, AiProviderFactory>();


// ---------- JWT ----------
builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));
builder.Services.AddScoped<ITokenService, TokenService>();

builder.Services.AddHostedService<TrainingAutoUnpublishService>();
builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();

// ✅ EKLENDİ: Jwt:Key byte uzunluk doğrulaması (HS256 min 16 byte)
var jwtSection = builder.Configuration.GetSection("Jwt");
var jwtKey = jwtSection["Key"] ?? "";
var jwtKeyBytes = Encoding.UTF8.GetBytes(jwtKey);

if (jwtKeyBytes.Length < 16)
{
    throw new InvalidOperationException(
        $"Jwt:Key en az 16 byte olmalı (HS256). Şu an: {jwtKeyBytes.Length} byte. " +
        $"(Muhtemelen Environment Variable veya dotnet user-secrets override ediyor)"
    );
}

// ✅ mevcut yapıyı bozmadan: JwtOptions yine bind ediliyor
var jwt = jwtSection.Get<JwtOptions>()!;

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.TokenValidationParameters = new()
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(jwtKeyBytes), // ✅ değişti: jwt.Key yerine doğrulanmış bytes
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
var webRoot = app.Environment.WebRootPath;
if (string.IsNullOrWhiteSpace(webRoot))
    webRoot = Path.Combine(app.Environment.ContentRootPath, "wwwroot");

Directory.CreateDirectory(webRoot);
Directory.CreateDirectory(Path.Combine(webRoot, "uploads", "trainings"));

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(webRoot),
    RequestPath = ""
});

app.UseRouting();

// CORS mutlaka Authentication/Authorization’dan ÖNCE
app.UseCors(ClientCors);

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers().RequireCors(ClientCors);
app.MapHub<AnalysisHub>("/hubs/analysis").RequireCors(ClientCors);

app.Run();