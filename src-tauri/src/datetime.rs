//! One place for every date/time operation (V151-S3-2).
//!
//! All commands must build, format and parse date/time values through this module; no command
//! calls the underlying crate directly. The stored formats are frozen: v1.3.x/v1.4.x/v1.5.0 data
//! must keep reading exactly the same and must keep being written exactly the same way.

use time::format_description::well_known::Rfc3339;
use time::{Date as TimeDate, Duration, Month, OffsetDateTime, UtcOffset};

/// A date key (`YYYY-MM-DD`).
pub type Date = TimeDate;

/// An absolute instant with an explicit offset.
pub type Instant = OffsetDateTime;

/// The current instant in UTC.
pub fn now_utc() -> Instant {
    OffsetDateTime::now_utc()
}

/// The current instant in the local time zone. Never panics.
///
/// Windows always provides a local offset. On the platforms where the offset cannot be read
/// safely (for example a background thread on Linux), keep working in UTC and say so once.
pub fn now_local() -> Instant {
    match OffsetDateTime::now_local() {
        Ok(value) => value,
        Err(error) => {
            eprintln!("local time offset is unavailable ({error}); continuing in UTC");
            OffsetDateTime::now_utc()
        }
    }
}

/// RFC 3339 with the offset as `+HH:MM` and the shortest exact subsecond run (0/3/6/9 digits).
pub fn format_rfc3339_auto(value: Instant) -> String {
    let mut out = format_date_time(value);
    out.push_str(&format_fraction(value.nanosecond()));
    out.push_str(&format_offset(value.offset()));
    out
}

/// RFC 3339 in UTC, milliseconds, with a trailing `Z` (the import format).
pub fn format_rfc3339_millis_utc(value: Instant) -> String {
    let value = value.to_offset(UtcOffset::UTC);
    format!(
        "{}.{:03}Z",
        format_date_time(value),
        value.nanosecond() / 1_000_000
    )
}

/// The file-name stamp `YYYYMMDD-HHMMSS-nnnnnnnnn` in the instant's own offset.
pub fn format_file_stamp_nanos(value: Instant) -> String {
    format!(
        "{:04}{:02}{:02}-{:02}{:02}{:02}-{:09}",
        value.year(),
        u8::from(value.month()),
        value.day(),
        value.hour(),
        value.minute(),
        value.second(),
        value.nanosecond()
    )
}

/// The file-name stamp `YYYYMMDD-HHMMSS` in the instant's own offset.
pub fn format_file_stamp_seconds(value: Instant) -> String {
    format!(
        "{:04}{:02}{:02}-{:02}{:02}{:02}",
        value.year(),
        u8::from(value.month()),
        value.day(),
        value.hour(),
        value.minute(),
        value.second()
    )
}

/// The stored date key `YYYY-MM-DD`.
pub fn format_date(date: Date) -> String {
    format!(
        "{:04}-{:02}-{:02}",
        date.year(),
        u8::from(date.month()),
        date.day()
    )
}

/// Reads a stored date key the same way the previous versions did.
///
/// The previous parser accepted one digit for the month and the day (`2026-7-8`) and rejected
/// surrounding spaces, so this keeps that behaviour.
pub fn parse_date(value: &str) -> Option<Date> {
    let mut parts = value.split('-');
    let year = parts.next()?;
    let month = parts.next()?;
    let day = parts.next()?;
    if parts.next().is_some() {
        return None;
    }
    if year.len() != 4 || !year.bytes().all(|byte| byte.is_ascii_digit()) {
        return None;
    }
    let numeric = |part: &str| -> Option<i64> {
        if part.is_empty() || part.len() > 2 || !part.bytes().all(|byte| byte.is_ascii_digit()) {
            return None;
        }
        part.parse().ok()
    };
    let month = Month::try_from(u8::try_from(numeric(month)?).ok()?).ok()?;
    let day = u8::try_from(numeric(day)?).ok()?;
    let year = year.parse::<i32>().ok()?;
    TimeDate::from_calendar_date(year, month, day).ok()
}

/// Reads a stored RFC 3339 instant.
///
/// The previous parser (chrono) also accepted a lowercase `t`/`z`, a space instead of `T`, a
/// comma as the decimal separator, more than nine fractional digits (truncated) and the leap
/// second `23:59:60` (normalised to the next second). Those inputs are still readable.
pub fn parse_rfc3339(value: &str) -> Option<Instant> {
    let mut normalized = normalize_rfc3339(value)?;
    let leap_second = normalized.get(17..19) == Some("60");
    if leap_second {
        normalized.replace_range(17..19, "59");
    }
    let parsed = OffsetDateTime::parse(&normalized, &Rfc3339).ok()?;
    Some(if leap_second {
        parsed.saturating_add(Duration::seconds(1))
    } else {
        parsed
    })
}
/// The offset applied to an instant, in seconds east of UTC (used by the golden tests).
#[cfg(test)]
pub fn offset_seconds(value: Instant) -> i32 {
    value.offset().whole_seconds()
}

/// Milliseconds since the Unix epoch.
pub fn timestamp_millis(value: Instant) -> i128 {
    value.unix_timestamp_nanos() / 1_000_000
}

/// Nanoseconds since the Unix epoch.
pub fn timestamp_nanos(value: Instant) -> i128 {
    value.unix_timestamp_nanos()
}

/// The date key for the day that contains `now`, with the day starting at `day_start_hour`.
pub fn date_key_at(now: Instant, day_start_hour: u8) -> String {
    let date = now.date();
    if now.hour() < day_start_hour.min(23) {
        format_date(date.previous_day().unwrap_or(date))
    } else {
        format_date(date)
    }
}

/// The date key for today, in the local time zone.
pub fn today_date(day_start_hour: u8) -> String {
    date_key_at(now_local(), day_start_hour)
}

/// The Monday that starts the week containing `date`.
pub fn week_start_date(date: Date) -> Date {
    let back = i64::from(date.weekday().number_days_from_monday());
    date.checked_sub(Duration::days(back)).unwrap_or(date)
}

/// `date` moved by `days` (negative moves backwards).
pub fn add_days(date: Date, days: i64) -> Date {
    date.checked_add(Duration::days(days)).unwrap_or(date)
}

/// True when `now` is at least `days` after `basis`.
pub fn is_at_least_days_old(basis: Instant, now: Instant, days: i64) -> bool {
    now - basis >= Duration::days(days)
}

fn format_date_time(value: Instant) -> String {
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}",
        value.year(),
        u8::from(value.month()),
        value.day(),
        value.hour(),
        value.minute(),
        value.second()
    )
}

fn format_fraction(nanoseconds: u32) -> String {
    if nanoseconds == 0 {
        String::new()
    } else if nanoseconds.is_multiple_of(1_000_000) {
        format!(".{:03}", nanoseconds / 1_000_000)
    } else if nanoseconds.is_multiple_of(1_000) {
        format!(".{:06}", nanoseconds / 1_000)
    } else {
        format!(".{nanoseconds:09}")
    }
}

fn format_offset(offset: UtcOffset) -> String {
    let total = offset.whole_seconds();
    let sign = if total < 0 { '-' } else { '+' };
    let total = total.abs();
    format!("{sign}{:02}:{:02}", total / 3600, (total % 3600) / 60)
}

/// Rewrites the relaxed inputs chrono used to accept into the strict RFC 3339 shape `time` reads.
fn normalize_rfc3339(value: &str) -> Option<String> {
    let bytes = value.as_bytes();
    if bytes.len() < 19 {
        return None;
    }
    if bytes[4] != b'-' || bytes[7] != b'-' {
        return None;
    }
    if !matches!(bytes[10], b'T' | b't' | b' ') {
        return None;
    }
    let mut out = String::with_capacity(value.len());
    out.push_str(value.get(0..10)?);
    out.push('T');
    out.push_str(value.get(11..19)?);

    let mut rest = value.get(19..)?.chars().peekable();
    if matches!(rest.peek(), Some('.') | Some(',')) {
        rest.next();
        let mut fraction = String::new();
        while let Some(character) = rest.peek().copied() {
            if !character.is_ascii_digit() {
                break;
            }
            if fraction.len() < 9 {
                fraction.push(character);
            }
            rest.next();
        }
        if fraction.is_empty() {
            return None;
        }
        out.push('.');
        out.push_str(&fraction);
    }

    let timezone: String = rest.collect();
    match timezone.as_str() {
        "Z" | "z" => out.push('Z'),
        _ if timezone.len() == 6
            && matches!(timezone.as_bytes()[0], b'+' | b'-')
            && timezone.as_bytes()[3] == b':' =>
        {
            out.push_str(&timezone);
        }
        _ => return None,
    }
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(value: &str) -> Instant {
        parse_rfc3339(value).unwrap_or_else(|| panic!("expected {value} to parse"))
    }

    fn key(value: &str) -> String {
        date_key_at(at(value), 4)
    }

    // Golden values below were produced by the chrono implementation before the replacement and
    // must not be edited when the implementation changes.
    #[test]
    fn writes_the_same_seven_shapes() {
        let no_fraction = at("2026-11-20T06:00:00+00:00");
        let millis = at("2026-11-20T06:00:00.120+00:00");
        let micros = at("2026-11-20T06:00:00.120456+00:00");
        let nanos = at("2026-11-20T06:00:00.120456789+00:00");

        assert_eq!(
            format_rfc3339_auto(no_fraction),
            "2026-11-20T06:00:00+00:00"
        );
        assert_eq!(format_rfc3339_auto(millis), "2026-11-20T06:00:00.120+00:00");
        assert_eq!(
            format_rfc3339_auto(micros),
            "2026-11-20T06:00:00.120456+00:00"
        );
        assert_eq!(
            format_rfc3339_auto(nanos),
            "2026-11-20T06:00:00.120456789+00:00"
        );

        assert_eq!(format_rfc3339_millis_utc(nanos), "2026-11-20T06:00:00.120Z");
        assert_eq!(
            format_rfc3339_millis_utc(at("2026-11-20T15:00:00.123456789+09:00")),
            "2026-11-20T06:00:00.123Z"
        );
        assert_eq!(
            format_rfc3339_millis_utc(at("2026-11-20T01:00:00.123456789-05:00")),
            "2026-11-20T06:00:00.123Z"
        );

        assert_eq!(
            format_file_stamp_nanos(at("2026-11-20T15:00:00.123456789+09:00")),
            "20261120-150000-123456789"
        );
        assert_eq!(
            format_file_stamp_nanos(at("2026-11-20T01:00:00.123456789-05:00")),
            "20261120-010000-123456789"
        );
        assert_eq!(
            format_file_stamp_nanos(at("2026-11-20T06:00:00+00:00")),
            "20261120-060000-000000000"
        );
        assert_eq!(
            format_file_stamp_seconds(at("2026-11-20T15:00:00.123456789+09:00")),
            "20261120-150000"
        );
        assert_eq!(
            format_file_stamp_seconds(at("2026-11-20T01:00:00.123456789-05:00")),
            "20261120-010000"
        );

        assert_eq!(
            format_date(parse_date("2026-11-20").expect("date")),
            "2026-11-20"
        );
        assert_eq!(timestamp_millis(nanos), 1_795_154_400_120);
        assert_eq!(timestamp_nanos(nanos), 1_795_154_400_120_456_789);
        assert_eq!(format!("{:x}", timestamp_millis(nanos)), "1a1f78a5378");
    }

    #[test]
    fn reads_the_same_stored_instants() {
        // (input, unix nanoseconds, offset seconds) as produced by chrono before the replacement.
        let cases = [
            (
                "2026-11-20T06:00:00+00:00",
                1_795_154_400_000_000_000_i128,
                0,
            ),
            (
                "2026-11-20T06:00:00.123456789+00:00",
                1_795_154_400_123_456_789,
                0,
            ),
            ("2026-11-20T06:00:00.123Z", 1_795_154_400_123_000_000, 0),
            (
                "2026-11-20T15:00:00+09:00",
                1_795_154_400_000_000_000,
                32_400,
            ),
            (
                "2026-11-20T01:00:00-05:00",
                1_795_154_400_000_000_000,
                -18_000,
            ),
            ("2026-11-20T06:00:00.1+00:00", 1_795_154_400_100_000_000, 0),
            ("2026-11-20T06:00:00.12+00:00", 1_795_154_400_120_000_000, 0),
            (
                "2026-11-20T06:00:00.1234567890+00:00",
                1_795_154_400_123_456_789,
                0,
            ),
            ("2026-11-20t06:00:00z", 1_795_154_400_000_000_000, 0),
            ("2026-11-20 06:00:00+00:00", 1_795_154_400_000_000_000, 0),
            ("2026-11-20T23:59:60+00:00", 1_795_219_200_000_000_000, 0),
        ];
        for (input, nanos, offset) in cases {
            let parsed = at(input);
            assert_eq!(timestamp_nanos(parsed), nanos, "unix nanos for {input}");
            assert_eq!(offset_seconds(parsed), offset, "offset for {input}");
        }

        for input in [
            "2026-02-29T06:00:00+00:00",
            "",
            "not-a-date",
            "2026-11-20T06:00:00",
        ] {
            assert!(
                parse_rfc3339(input).is_none(),
                "{input} must stay unreadable"
            );
        }

        for (input, expected) in [
            ("2026-7-8", Some("2026-07-08")),
            ("2026-07-8", Some("2026-07-08")),
            ("2026-7-08", Some("2026-07-08")),
            ("2026-02-29", None),
            ("2028-02-29", Some("2028-02-29")),
            ("2026-13-01", None),
            ("", None),
            (" 2026-07-08 ", None),
        ] {
            assert_eq!(
                parse_date(input).map(format_date),
                expected.map(str::to_string)
            );
        }
    }

    #[test]
    fn computes_the_same_dates() {
        assert_eq!(key("2026-11-20T03:59:59+09:00"), "2026-11-19");
        assert_eq!(key("2026-11-20T04:00:00+09:00"), "2026-11-20");
        assert_eq!(key("2026-11-20T06:00:00+00:00"), "2026-11-20");
        assert_eq!(key("2026-11-20T01:00:00-05:00"), "2026-11-19");
        assert_eq!(key("2026-11-20T05:00:00-05:00"), "2026-11-20");

        let starts = [
            ("2026-07-12", "2026-07-06"),
            ("2026-07-13", "2026-07-13"),
            ("2026-11-20", "2026-11-16"),
            ("2026-01-01", "2025-12-29"),
            ("2028-02-29", "2028-02-28"),
        ];
        for (date, start) in starts {
            let date = parse_date(date).expect("date");
            assert_eq!(format_date(week_start_date(date)), start);
        }

        let end_of_month = parse_date("2026-07-31").expect("date");
        assert_eq!(format_date(add_days(end_of_month, 1)), "2026-08-01");
        let end_of_year = parse_date("2026-12-31").expect("date");
        assert_eq!(format_date(add_days(end_of_year, 1)), "2027-01-01");
    }
}
