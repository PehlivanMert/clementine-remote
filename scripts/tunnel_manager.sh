#!/bin/bash
# ========================================================
# Clementine Web Remote Cloudflare Tunnel Yöneticisi
# ========================================================

unset LD_PRELOAD
unset LD_LIBRARY_PATH
export PATH="/usr/bin:/bin:/usr/local/bin:/home/mert/.local/bin:$PATH"

GIST_ID="450d94b168498b7b178cd9f1ce667344"
NTFY_TOPIC="clementine_remote_mert_tunnel_450d9"
TUNNEL_BIN="$HOME/.local/bin/cloudflared"
TUNNEL_LOG="/tmp/clementine_cloudflared.log"
TUNNEL_PID_FILE="/tmp/clementine_cloudflared.pid"
MGR_LOG="/tmp/clementine_tunnel_manager.log"

log_msg() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$MGR_LOG"
}

start_tunnel() {
    stop_tunnel >/dev/null 2>&1

    if [ ! -x "$TUNNEL_BIN" ]; then
        echo "cloudflared bulunamadı!"
        log_msg "HATA: cloudflared bulunamadı!"
        return 1
    fi

    echo "Cloudflare HTTPS Tüneli başlatılıyor (Hedef: http://127.0.0.1:8000)..."
    log_msg "Clementine tüneli başlatılıyor..."
    rm -f "$TUNNEL_LOG"
    env -u LD_PRELOAD -u LD_LIBRARY_PATH setsid "$TUNNEL_BIN" tunnel --url http://127.0.0.1:8000 > "$TUNNEL_LOG" 2>&1 &
    local cpid=$!
    echo "$cpid" > "$TUNNEL_PID_FILE"

    # Tünel URL'sini ve edge bağlantısını bekle (en fazla 25 saniye)
    local url=""
    for i in {1..25}; do
        sleep 1
        url=$(grep -o 'https://[^ ]*\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | head -n1)
        if [ -n "$url" ] && grep -q "Registered tunnel connection" "$TUNNEL_LOG" 2>/dev/null; then
            break
        fi
    done

    if [ -n "$url" ]; then
        echo "Tünel hazır: $url"
        log_msg "Tünel hazır: $url"
        
        # 1. ntfy.sh anlık pub/sub köprüsünü güncelle (Kotasız, doğrudan tıkla-aç desteği)
        if curl -s --max-time 4 -X POST \
            -H "Title: Clementine Web Remote Aktif" \
            -H "Priority: default" \
            -H "Tags: musical_note,headphones" \
            -H "Click: $url" \
            -d "$url" "https://ntfy.sh/$NTFY_TOPIC" >/dev/null 2>&1; then
            log_msg "ntfy.sh köprüsü başarıyla güncellendi: $url"
        else
            log_msg "UYARI: ntfy.sh curl başarısız oldu!"
        fi
        
        # 2. Gist'i API ile güncelle (Yedek)
        local payload="{\"tunnel\": \"$url\", \"updated\": $(date +%s)}"
        gh api -X PATCH "/gists/$GIST_ID" -F "files[clementine_tunnel.json][content]=$payload" >/dev/null 2>&1 &
        echo "PWA bağlantı köprüsü güncellendi (ntfy.sh + Gist)."
    else
        echo "Tünel URL'si alınamadı (zaman aşımı)."
        log_msg "HATA: Tünel URL'si alınamadı (zaman aşımı)."
    fi
}

stop_tunnel() {
    if [ -f "$TUNNEL_PID_FILE" ]; then
        local pid=$(cat "$TUNNEL_PID_FILE" 2>/dev/null)
        if [ -n "$pid" ]; then
            kill "$pid" 2>/dev/null
        fi
        rm -f "$TUNNEL_PID_FILE"
    fi
    pkill -f "cloudflared tunnel.*8000" 2>/dev/null
    
    # 1. ntfy.sh anlık köprüsünü çevrimdışı yap
    curl -s --max-time 4 -X POST \
        -H "Title: Clementine Web Remote Durduruldu" \
        -H "Tags: white_circle,zzz" \
        -d "OFFLINE" "https://ntfy.sh/$NTFY_TOPIC" >/dev/null 2>&1
    log_msg "ntfy.sh OFFLINE gönderildi."
    
    # 2. Gist'i çevrimdışı yap (Yedek)
    local payload="{\"tunnel\": \"\", \"updated\": $(date +%s)}"
    gh api -X PATCH "/gists/$GIST_ID" -F "files[clementine_tunnel.json][content]=$payload" >/dev/null 2>&1 &
    echo "Cloudflare Tüneli durduruldu."
    log_msg "Cloudflare Tüneli durduruldu."
}

case "$1" in
    start)
        start_tunnel
        ;;
    stop)
        stop_tunnel
        ;;
    status)
        cur_url=$(grep -o 'https://[^ ]*\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | head -n1)
        if [ -n "$cur_url" ] && pgrep -f "cloudflared tunnel.*8000" >/dev/null; then
            echo "Tünel aktif: $cur_url"
        else
            echo "Tünel aktif değil."
        fi
        ;;
    get-url)
        cur_url=$(grep -o 'https://[^ ]*\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | head -n1)
        if [ -n "$cur_url" ] && pgrep -f "cloudflared tunnel.*8000" >/dev/null; then
            echo "$cur_url"
        fi
        ;;
    *)
        echo "Kullanım: $0 {start|stop|status|get-url}"
        ;;
esac
