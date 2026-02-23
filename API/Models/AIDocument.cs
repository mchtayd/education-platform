namespace API.Models;

public class AIDocument
{
    public int Id { get; set; }
    public string FileName { get; set; } = "";
    public string StoredFileName { get; set; } = "";
    public long SizeBytes { get; set; }
    public DateTimeOffset UploadedAt { get; set; }
}