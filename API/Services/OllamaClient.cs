using System.Text.Json;
using System.Text;
using Microsoft.Extensions.Options;
using API.Options;

namespace API.Services;

public class OllamaClient
{
    private readonly HttpClient _http;
    private readonly OllamaOptions _opt;

    public OllamaClient(HttpClient http, IOptions<OllamaOptions> opt)
    {
        _http = http;
        _opt = opt.Value;
    }

    public async Task<float[]> EmbedAsync(string text, CancellationToken ct = default)
    {
        var body = new { model = _opt.EmbedModel, prompt = text };
        var res = await _http.PostAsync("/api/embeddings", Json(body), ct);
        res.EnsureSuccessStatusCode();

        using var stream = await res.Content.ReadAsStreamAsync(ct);
        var data = await JsonSerializer.DeserializeAsync<EmbResponse>(stream, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        }, ct);

        return data?.Embedding ?? Array.Empty<float>();
    }

    public async Task<string> ChatAsync(IEnumerable<ChatMessage> messages, CancellationToken ct = default)
    {
        var body = new
        {
            model = _opt.ChatModel,
            stream = false,
            messages = messages.Select(m => new { role = m.Role, content = m.Content }).ToArray()
        };

        var res = await _http.PostAsync("/api/chat", Json(body), ct);
        res.EnsureSuccessStatusCode();

        using var stream = await res.Content.ReadAsStreamAsync(ct);
        var data = await JsonSerializer.DeserializeAsync<ChatResponse>(stream, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        }, ct);

        return data?.Message?.Content ?? "";
    }

    private static StringContent Json<T>(T obj) =>
        new StringContent(JsonSerializer.Serialize(obj), Encoding.UTF8, "application/json");

    private sealed class EmbResponse
    {
        public float[]? Embedding { get; set; }
    }

    private sealed class ChatResponse
    {
        public ChatMessageDto? Message { get; set; }
    }

    private sealed class ChatMessageDto
    {
        public string? Role { get; set; }
        public string? Content { get; set; }
    }
}

public record ChatMessage(string Role, string Content);