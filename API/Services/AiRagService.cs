using API.Data;
using API.Models;
using API.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace API.Services;

public class AiRagService
{
    private readonly AppDbContext _db;
    private readonly PdfTextExtractor _pdf;
    private readonly IAiProviderFactory _providerFactory;
    private readonly AiProviderOptions _aiOpt;

    public AiRagService(
        AppDbContext db,
        PdfTextExtractor pdf,
        IAiProviderFactory providerFactory,
        IOptions<AiProviderOptions> aiOpt)
    {
        _db = db;
        _pdf = pdf;
        _providerFactory = providerFactory;
        _aiOpt = aiOpt.Value;
    }

    // provider param eklendi (default: config)
    public async Task IndexDocumentAsync(int docId, string filePath, string? provider = null, CancellationToken ct = default)
    {
        var ai = _providerFactory.Get(provider);

        // eski chunk’ları sil (reindex için)
        var old = await _db.AIDocumentChunks.Where(x => x.DocumentId == docId).ToListAsync(ct);
        if (old.Count > 0) _db.AIDocumentChunks.RemoveRange(old);
        await _db.SaveChangesAsync(ct);

        var text = _pdf.ExtractText(filePath);
        if (string.IsNullOrWhiteSpace(text))
            throw new InvalidOperationException("PDF'den metin çıkarılamadı. PDF tarama olabilir (OCR gerekir).");

        var chunks = Chunk(text, chunkSize: 1200, overlap: 200);

        var idx = 0;
        foreach (var chunk in chunks)
        {
            var emb = await ai.EmbedAsync(chunk, AiEmbeddingPurpose.Document, ct);

            _db.AIDocumentChunks.Add(new AIDocumentChunk
            {
                DocumentId = docId,
                ChunkIndex = idx++,
                Text = chunk.Length > 12000 ? chunk[..12000] : chunk,
                Embedding = emb
            });
        }

        await _db.SaveChangesAsync(ct);
    }

    // provider param eklendi (frontend switch buradan gelir)
    public async Task<(string answer, List<AiSource> sources)> AskAsync(
        string question,
        int topK = 8,
        string? provider = null,
        CancellationToken ct = default)
    {
        var ai = _providerFactory.Get(provider);

        var qEmb = await ai.EmbedAsync(question, AiEmbeddingPurpose.Query, ct);
        if (qEmb.Length == 0)
            return ("Embedding üretilemedi.", new());

        // küçük/orta ölçek için: tüm chunk’ları çekip C#’ta benzerlik hesapla
        var all = await _db.AIDocumentChunks
            .Include(x => x.Document)
            .AsNoTracking()
            .ToListAsync(ct);

        // ✅ Sağlayıcı değişimi sonrası karışık embedding riskine karşı:
        // vektör boyutu uyuşmayan chunk’ları ele
        var compatible = all
            .Where(x => x.Embedding != null && x.Embedding.Length == qEmb.Length)
            .ToList();

        if (compatible.Count == 0)
        {
            return ($"Bu provider ({ai.Name}) ile uyumlu index bulunamadı. Dokümanları bu provider ile yeniden indexleyin.", new());
        }

        var threshold = Math.Clamp(_aiOpt.ScoreThreshold, 0f, 1f);

        var scored = compatible
            .Select(x => new
            {
                Chunk = x,
                Score = Cosine(qEmb, x.Embedding)
            })
            .OrderByDescending(x => x.Score)
            .Take(Math.Clamp(topK, 1, 20))
            .Where(x => x.Score >= threshold)
            .ToList();

        if (scored.Count == 0)
        {
            return ("Dokümanlarda bu sorunun yanıtı bulunamadı.", new());
        }

        var context = string.Join("\n\n---\n\n", scored.Select(s =>
            $"[Kaynak: {s.Chunk.Document.FileName} | Parça #{s.Chunk.ChunkIndex} | Skor {s.Score:0.00}]\n{s.Chunk.Text}"
        ));

        var system = """
Sen sadece aşağıdaki "DOKUMAN ALINTILARI" bölümüne dayanarak cevap vereceksin.
Dış bilgi, tahmin, internet, genel kültür kullanma.
Eğer alıntılarda cevap yoksa: "Dokümanlarda bu sorunun yanıtı bulunamadı." de.
Cevabı Türkçe ver.
Önce kısa ve net cevap ver, sonra gerekiyorsa maddeler halinde açıkla.
Mümkünse cevapta geçen terimleri dokümandaki ifadeye sadık kalarak kullan.
""";

        var messages = new List<ChatMessage>
        {
            new("system", system),
            new("user", $"DOKUMAN ALINTILARI:\n{context}\n\nSORU:\n{question}")
        };

        var answer = await ai.ChatAsync(messages, ct);

        // Güvenlik: model prompta rağmen dışarı taşarsa (nadir) basic fallback
        if (string.IsNullOrWhiteSpace(answer))
            answer = "Dokümanlarda bu sorunun yanıtı bulunamadı.";

        var sources = scored.Select(s => new AiSource
        {
            DocumentId = s.Chunk.DocumentId,
            FileName = s.Chunk.Document.FileName,
            ChunkIndex = s.Chunk.ChunkIndex,
            Score = s.Score,
            Text = s.Chunk.Text.Length > 600 ? s.Chunk.Text[..600] + "..." : s.Chunk.Text
        }).ToList();

        return (answer, sources);
    }

    private static List<string> Chunk(string text, int chunkSize, int overlap)
    {
        text = text.Replace("\r\n", "\n");
        var list = new List<string>();

        if (chunkSize <= 0) chunkSize = 1200;
        if (overlap < 0) overlap = 0;
        if (overlap >= chunkSize) overlap = Math.Max(0, chunkSize / 4);

        var step = chunkSize - overlap;
        var i = 0;

        while (i < text.Length)
        {
            var len = Math.Min(chunkSize, text.Length - i);
            var part = text.Substring(i, len).Trim();
            if (!string.IsNullOrWhiteSpace(part))
                list.Add(part);

            i += step;
            if (i < 0) break;
        }

        return list;
    }

    private static float Cosine(float[] a, float[] b)
    {
        if (a.Length == 0 || b.Length == 0) return 0;
        var n = Math.Min(a.Length, b.Length);

        double dot = 0, na = 0, nb = 0;
        for (int i = 0; i < n; i++)
        {
            dot += a[i] * b[i];
            na += a[i] * a[i];
            nb += b[i] * b[i];
        }

        if (na == 0 || nb == 0) return 0;
        return (float)(dot / (Math.Sqrt(na) * Math.Sqrt(nb)));
    }
}

public class AiSource
{
    public int DocumentId { get; set; }
    public string FileName { get; set; } = "";
    public int ChunkIndex { get; set; }
    public float Score { get; set; }
    public string Text { get; set; } = "";
}