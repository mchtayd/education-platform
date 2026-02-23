using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using API.Options;
using Microsoft.Extensions.Options;

namespace API.Services;

public class GeminiClient
{
    private readonly HttpClient _http;
    private readonly GeminiOptions _opt;
    private readonly ILogger<GeminiClient> _logger;

    public GeminiClient(HttpClient http, IOptions<GeminiOptions> opt, ILogger<GeminiClient> logger)
    {
        _http = http;
        _opt = opt.Value;
        _logger = logger;

        if (_http.BaseAddress is null)
            _http.BaseAddress = new Uri(_opt.BaseUrl);
    }

    private string ResolveApiKey()
    {
        var key = !string.IsNullOrWhiteSpace(_opt.ApiKey)
            ? _opt.ApiKey
            : Environment.GetEnvironmentVariable("GEMINI_API_KEY");

        if (string.IsNullOrWhiteSpace(key))
            throw new InvalidOperationException("Gemini API key bulunamadı. appsettings veya GEMINI_API_KEY tanımlayın.");

        return key;
    }

    public async Task<float[]> EmbedAsync(string text, AiEmbeddingPurpose purpose, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(text))
            return Array.Empty<float>();

        var apiKey = ResolveApiKey();

        // Gemini embeddings REST (embedContent)
        // Dokümanlar / sorgular için taskType isteğe bağlı (retrieval kalitesini artırabilir).
        var taskType = purpose == AiEmbeddingPurpose.Document ? "RETRIEVAL_DOCUMENT" : "RETRIEVAL_QUERY";

        var body = new
        {
            model = $"models/{_opt.EmbeddingModel}",
            content = new
            {
                parts = new[]
                {
                    new { text }
                }
            },
            taskType
            // outputDimensionality = 768 // istersen açabilirsin, şimdilik model default bıraktık
        };

        using var req = new HttpRequestMessage(
            HttpMethod.Post,
            $"models/{_opt.EmbeddingModel}:embedContent")
        {
            Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json")
        };

        req.Headers.Add("x-goog-api-key", apiKey);

        using var res = await _http.SendAsync(req, ct);
        var raw = await res.Content.ReadAsStringAsync(ct);

        if (!res.IsSuccessStatusCode)
        {
            _logger.LogError("Gemini embed failed. Status={Status}, Body={Body}", (int)res.StatusCode, raw);
            throw new InvalidOperationException($"Gemini embedding hatası ({(int)res.StatusCode}): {raw}");
        }

        using var doc = JsonDocument.Parse(raw);

        // Beklenen response: { "embedding": { "values": [ ... ] } }
        if (!doc.RootElement.TryGetProperty("embedding", out var embObj) ||
            !embObj.TryGetProperty("values", out var valuesEl) ||
            valuesEl.ValueKind != JsonValueKind.Array)
        {
            throw new InvalidOperationException("Gemini embedding response parse edilemedi.");
        }

        var list = new List<float>(valuesEl.GetArrayLength());
        foreach (var item in valuesEl.EnumerateArray())
        {
            // JSON number -> float
            if (item.TryGetSingle(out var f))
                list.Add(f);
            else if (item.TryGetDouble(out var d))
                list.Add((float)d);
        }

        return list.ToArray();
    }

    public async Task<string> GenerateContentAsync(List<ChatMessage> messages, CancellationToken ct = default)
    {
        var apiKey = ResolveApiKey();

        // Gemini REST role yapısı user/model. System instruction ayrı alan olarak gönderilebilir.
        string? systemText = null;
        var contents = new List<object>();

        foreach (var m in messages)
        {
            var role = (m.Role ?? "").Trim().ToLowerInvariant();
            var text = (m.Content ?? "").Trim();
            if (string.IsNullOrWhiteSpace(text)) continue;

            if (role == "system")
            {
                systemText = string.IsNullOrWhiteSpace(systemText)
                    ? text
                    : systemText + "\n\n" + text;
                continue;
            }

            contents.Add(new
            {
                role = role == "assistant" ? "model" : "user",
                parts = new[]
                {
                    new { text }
                }
            });
        }

        if (contents.Count == 0)
            throw new InvalidOperationException("Gemini generateContent için gönderilecek içerik yok.");

        var payload = new
        {
            system_instruction = string.IsNullOrWhiteSpace(systemText)
                ? null
                : new
                {
                    parts = new[]
                    {
                        new { text = systemText }
                    }
                },
            contents,
            generationConfig = new
            {
                temperature = 0.1
            }
        };

        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions
        {
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
        });

        using var req = new HttpRequestMessage(
            HttpMethod.Post,
            $"models/{_opt.ChatModel}:generateContent")
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json")
        };
        req.Headers.Add("x-goog-api-key", apiKey);

        using var res = await _http.SendAsync(req, ct);
        var raw = await res.Content.ReadAsStringAsync(ct);

        if (!res.IsSuccessStatusCode)
        {
            _logger.LogError("Gemini generate failed. Status={Status}, Body={Body}", (int)res.StatusCode, raw);
            throw new InvalidOperationException($"Gemini chat hatası ({(int)res.StatusCode}): {raw}");
        }

        using var doc = JsonDocument.Parse(raw);

        // candidates[0].content.parts[*].text
        if (!doc.RootElement.TryGetProperty("candidates", out var cands) || cands.GetArrayLength() == 0)
        {
            // bazen prompt blocked vs olabilir
            if (doc.RootElement.TryGetProperty("promptFeedback", out var feedback))
                throw new InvalidOperationException($"Gemini cevap üretmedi. promptFeedback: {feedback}");
            throw new InvalidOperationException("Gemini cevap üretmedi.");
        }

        var first = cands[0];

        if (!first.TryGetProperty("content", out var content) ||
            !content.TryGetProperty("parts", out var parts) ||
            parts.ValueKind != JsonValueKind.Array)
        {
            throw new InvalidOperationException("Gemini response içeriği parse edilemedi.");
        }

        var sb = new StringBuilder();
        foreach (var part in parts.EnumerateArray())
        {
            if (part.TryGetProperty("text", out var txt))
                sb.AppendLine(txt.GetString());
        }

        var result = sb.ToString().Trim();
        if (string.IsNullOrWhiteSpace(result))
            throw new InvalidOperationException("Gemini boş cevap döndü.");

        return result;
    }
}