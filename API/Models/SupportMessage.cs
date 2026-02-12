// Models/SupportMessage.cs
using System.ComponentModel.DataAnnotations;

namespace API.Models
{
    public class SupportMessage
    {
        public int Id { get; set; }

        public int ThreadId { get; set; }
        public SupportThread Thread { get; set; } = null!;

        public int SenderUserId { get; set; }     // hem user hem admin (Users tablosu)
        public bool IsFromAdmin { get; set; }

        [MaxLength(4000)]
        public string Body { get; set; } = "";

        public DateTimeOffset CreatedAt { get; set; }

        // global okundu bilgisi (admin tarafı ortak inbox)
        public DateTimeOffset? ReadAtAdmin { get; set; }
        public DateTimeOffset? ReadAtUser { get; set; }
    }
}
