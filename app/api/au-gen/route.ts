// app/api/au-gen/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // ✅ Nhận FormData (vì client gửi FormData với files)
    const formData = await req.formData();

    const llos_text = (formData.get("llos_text") as string | null) || "";
    const learner_level = (formData.get("learner_level") as string | null) || "";
    const bloom_level = (formData.get("bloom_level") as string | null) || "";
    const specialty_name =
      (formData.get("specialty_name") as string | null) || "không rõ";
    const course_title =
      (formData.get("course_title") as string | null) || "";
    const lesson_title =
      (formData.get("lesson_title") as string | null) || "";

    // Có thể có nhiều "files"
    const files = formData.getAll("files") as File[];
    const fileNames = files.map((f) => f.name).filter(Boolean);

    if (!llos_text.trim()) {
      return NextResponse.json(
        { error: "Thiếu LLOs để tạo AU" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("OPENAI_API_KEY không tồn tại trong môi trường server");
      return NextResponse.json(
        { error: "Thiếu OPENAI_API_KEY trên server" },
        { status: 500 }
      );
    }

    const model = (process.env.OPENAI_LLO_MODEL || "gpt-5.1").trim();

    const prompt = `
Bạn là chuyên gia giáo dục Y khoa và thiết kế đánh giá.

Nhiệm vụ: Từ danh sách LLO phía dưới, hãy tạo danh sách Assessment Units (AU) – 
các đơn vị kiến thức nhỏ nhất có thể kiểm tra, để dùng về sau cho Misconceptions & MCQ.

Bối cảnh:
- Chuyên ngành: ${specialty_name}
- Học phần: ${course_title || "không rõ"}
- Bài học: ${lesson_title || "không rõ"}
- Bậc học: ${learner_level || "không rõ"}
- Mức Bloom mục tiêu: ${bloom_level || "không rõ"}

Tài liệu bài học (chỉ có tên file, không cần tóm tắt chi tiết):
${fileNames.length ? fileNames.map((n) => "- " + n).join("\n") : "- (không có tài liệu đính kèm)"}

LLO của bài học (mỗi dòng là một LLO):
${llos_text}

Yêu cầu tạo AU:
- Mỗi AU là một "fact" hoặc mệnh đề kiến thức cụ thể, rõ ràng, không mơ hồ.
- Không gộp nhiều ý vào một AU.
- Viết sao cho có thể kiểm tra bằng MCQ, ví dụ: "Giải thích được...", "Mô tả được...", "Phân biệt được...".
- Mỗi AU có thể kèm một giải thích ngắn 1–2 câu giúp hiểu rõ thêm.
- Nếu suy luận được mức Bloom tối thiểu phù hợp của AU, hãy gán vào trường "bloom_min" (remember|understand|apply|analyze|evaluate|create). Nếu không chắc, có thể để null.

Chỉ trả lời BẰNG JSON "sạch" với cấu trúc CHÍNH XÁC như sau, không thêm bất cứ trường nào khác, không thêm text bên ngoài JSON:

{
  "aus": [
    {
      "core_statement": "AU 1 ...",
      "short_explanation": "Giải thích ngắn gọn về AU 1 ...",
      "bloom_min": "apply"
    },
    {
      "core_statement": "AU 2 ...",
      "short_explanation": "Giải thích ngắn gọn về AU 2 ...",
      "bloom_min": "analyze"
    }
  ]
}
`.trim();

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input: prompt,
        // ✅ Bắt model xuất JSON "sạch"
        text: {
          format: { type: "json" }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI /responses error:", errorText);
      return NextResponse.json(
        { error: "Lỗi khi gọi GPT", detail: errorText },
        { status: 500 }
      );
    }

    const data = await response.json();

    // ✅ Responses API kiểu mới: lấy text từ output[0].content[0].text
    const rawText: string =
      data?.output?.[0]?.content?.[0]?.text ??
      data?.output_text ?? // fallback nếu OpenAI vẫn trả field này
      "";

    if (!rawText) {
      console.error("Không có output text hợp lệ trong Responses:", data);
      return NextResponse.json(
        { error: "GPT không trả về nội dung" },
        { status: 500 }
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (err) {
      console.error("JSON parse error từ GPT:", err, "raw:", rawText);
      return NextResponse.json(
        { error: "GPT trả về JSON sai format", raw: rawText },
        { status: 500 }
      );
    }

    // Đảm bảo luôn trả về { aus: [...] }
    if (!parsed || !Array.isArray(parsed.aus)) {
      console.error("JSON không có field 'aus' đúng dạng:", parsed);
      return NextResponse.json(
        { error: "JSON không có mảng 'aus' hợp lệ", raw: parsed },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        aus: parsed.aus
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Lỗi server /api/au-gen:", err);
    return NextResponse.json(
      { error: "Lỗi server", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
