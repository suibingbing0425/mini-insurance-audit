import pdfplumber

path = r"E:\创智爱康实习文档\医疗保障基金智能监管规则库、知识库\2025年版医疗保障基金智能监管规则库、知识库.pdf"

# 要找的规则（序号+名称），对应我们的 checker
targets = [
    "药品限支付疗程", "药品儿童禁用", "药品区分性别使用",
    "超说明书用量开药", "重复开药", "药品相互作用"
]

with pdfplumber.open(path) as pdf:
    # 规则框架在第 13-62 页，遍历找目标规则
    print("=== 搜索规则框架说明（第 13-62 页）===")
    for i in range(12, 62):
        text = pdf.pages[i].extract_text() or ""
        for t in targets:
            # 匹配 "数字.规则名" 格式（框架标题）
            if t in text and (f".{t}" in text or f"．{t}" in text or f" {t}" in text):
                print(f"\n----- 第 {i+1} 页（含「{t}」）-----")
                print(text)
                break
