package logging

import (
	"fmt"
	"math"
	"os"
	"strings"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

const (
	requestIDField = "reqId"
)

type RequestIDKey struct{}

func New(prettyLogging bool, debug bool, level zapcore.Level) *zap.Logger {
	return NewZapLoggerWithSyncer(zapcore.AddSync(os.Stdout), prettyLogging, debug, level)
}

func zapBaseEncoderConfig() zapcore.EncoderConfig {
	ec := zap.NewProductionEncoderConfig()
	ec.EncodeDuration = zapcore.SecondsDurationEncoder
	ec.TimeKey = "time"
	return ec
}

func ZapJsonEncoder() zapcore.Encoder {
	ec := zapBaseEncoderConfig()
	ec.EncodeTime = func(t time.Time, enc zapcore.PrimitiveArrayEncoder) {
		nanos := t.UnixNano()
		millis := int64(math.Trunc(float64(nanos) / float64(time.Millisecond)))
		enc.AppendInt64(millis)
	}
	return zapcore.NewJSONEncoder(ec)
}

func zapConsoleEncoder() zapcore.Encoder {
	ec := zapBaseEncoderConfig()
	ec.ConsoleSeparator = " "
	ec.EncodeTime = zapcore.TimeEncoderOfLayout("15:04:05 PM")
	ec.EncodeLevel = zapcore.CapitalColorLevelEncoder
	return zapcore.NewConsoleEncoder(ec)
}

func attachBaseFields(logger *zap.Logger) *zap.Logger {
	host, err := os.Hostname()
	if err != nil {
		host = "unknown"
	}

	logger = logger.With(
		zap.String("hostname", host),
		zap.Int("pid", os.Getpid()),
	)

	return logger
}

func defaultZapCoreOptions(debug bool) []zap.Option {
	var zapOpts []zap.Option

	if debug {
		zapOpts = append(zapOpts, zap.AddCaller())
	}

	zapOpts = append(zapOpts, zap.AddStacktrace(zap.ErrorLevel))

	return zapOpts
}

func NewZapLoggerWithCore(core zapcore.Core, debug bool) *zap.Logger {
	zapLogger := zap.New(core, defaultZapCoreOptions(debug)...)

	zapLogger = attachBaseFields(zapLogger)

	return zapLogger
}

func NewZapLoggerWithSyncer(syncer zapcore.WriteSyncer, prettyLogging bool, debug bool, level zapcore.Level) *zap.Logger {
	var encoder zapcore.Encoder

	if prettyLogging {
		encoder = zapConsoleEncoder()
	} else {
		encoder = ZapJsonEncoder()
	}

	zapLogger := zap.New(zapcore.NewCore(
		encoder,
		syncer,
		level,
	), defaultZapCoreOptions(debug)...)

	zapLogger = attachBaseFields(zapLogger)

	return zapLogger
}

func ZapLogLevelFromString(logLevel string) (zapcore.Level, error) {
	switch strings.ToUpper(logLevel) {
	case "DEBUG":
		return zap.DebugLevel, nil
	case "INFO":
		return zap.InfoLevel, nil
	case "WARNING":
		return zap.WarnLevel, nil
	case "ERROR":
		return zap.ErrorLevel, nil
	case "FATAL":
		return zap.FatalLevel, nil
	case "PANIC":
		return zap.PanicLevel, nil
	default:
		return -1, fmt.Errorf("unknown log level: %s", logLevel)
	}
}

func WithRequestID(reqID string) zap.Field {
	return zap.String(requestIDField, reqID)
}
